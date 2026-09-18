// Jobly content script.
//
// Runs on every page (so it can react to a "capture" click from the popup
// no matter what job site you're on), and extracts whatever it can about
// the job posting from the DOM/page metadata. This is what makes LinkedIn
// work at all: a server-side fetch of a LinkedIn job URL hits a login wall,
// but this script runs inside your own already-authenticated tab and just
// reads the rendered page, the same way you would with your eyes.
//
// Nothing here is fetched or sent anywhere on its own - it only responds
// when the popup asks it to extract the current page.

function text(el) {
  return el ? el.textContent.trim().replace(/\s+/g, " ") : undefined;
}

function firstMatch(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = text(el);
    if (t) return t;
  }
  return undefined;
}

// LinkedIn's visible DOM uses hashed, auto-generated CSS classes
// (e.g. "_453cf893 a7f37fac ...") that change on every LinkedIn deploy, so
// selector-based scraping doesn't hold up there. What LinkedIn does keep
// stable is the document title, which it sets to
// "{Job Title} | {Company} | LinkedIn" - that's what we parse instead.
function extractLinkedInFromTitle() {
  const raw = document.title || "";
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2 && /linkedin/i.test(parts[parts.length - 1])) {
    return {
      title: parts[0],
      company: parts.length >= 3 ? parts.slice(1, -1).join(" | ") : undefined,
    };
  }
  return null;
}

// The company name also appears as visible link text pointing at its
// LinkedIn company page - that href pattern is stable even though the
// class names on the link aren't.
function extractLinkedInCompanyLink() {
  return text(document.querySelector('a[href*="/company/"]'));
}

// The location line reads like "Istanbul, Istanbul, Türkiye (On-site)".
const LOCATION_LINE_RE = /^.{3,100}\((On-site|Hybrid|Remote)\)$/i;

function firstLocationLine(text) {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (LOCATION_LINE_RE.test(line)) {
      // Strip a leading "Company · " / "Company • " bit if present, since
      // the company is already captured separately.
      return line.split(/\s*[·•]\s*/).pop() || line;
    }
  }
  return undefined;
}

// Scan the visible page text for a location-shaped line - but scoped to
// the currently OPEN posting, not the whole page. On a LinkedIn job
// search page the left-hand job-list sidebar (other postings) sits
// before the open posting's own detail pane in document order, so a
// whole-page top-down scan can grab a different job's location. Instead,
// walk up from the company link (which - unlike the sidebar cards -
// reliably points at the open posting's own /company/ page) through a
// few ancestor levels, checking each container's own text first, so the
// nearest/smallest container that has a location line wins.
function extractLinkedInLocation() {
  const companyLink = document.querySelector('a[href*="/company/"]');
  if (companyLink) {
    let node = companyLink.parentElement;
    for (let i = 0; i < 8 && node; i++) {
      const found = firstLocationLine(node.innerText);
      if (found) return found;
      node = node.parentElement;
    }
  }

  // Fallback for when there's no company link to anchor to (e.g. a
  // single job page rather than the search results layout).
  return firstLocationLine((document.body?.innerText || "").split("\n").slice(0, 80).join("\n"));
}

function extractLinkedIn() {
  const fromTitle = extractLinkedInFromTitle();
  const title = fromTitle?.title;
  const company = fromTitle?.company || extractLinkedInCompanyLink();
  const location = extractLinkedInLocation();

  if (!title && !company) return null;
  return { title, company, location, source: "linkedin" };
}

function extractJsonLd() {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const candidates = Array.isArray(data) ? data : [data];
      for (const item of candidates) {
        const node =
          item["@type"] === "JobPosting"
            ? item
            : (item["@graph"] || []).find((g) => g["@type"] === "JobPosting");
        if (node) {
          const company =
            node.hiringOrganization?.name || node.hiringOrganization?.legalName;
          const location =
            node.jobLocation?.address?.addressLocality ||
            (typeof node.jobLocation === "string" ? node.jobLocation : undefined);
          const salaryVal = node.baseSalary?.value;
          const salary = salaryVal
            ? salaryVal.value ||
              (salaryVal.minValue &&
                `${salaryVal.minValue}-${salaryVal.maxValue} ${node.baseSalary.currency || ""}`.trim())
            : undefined;
          return {
            title: node.title,
            company,
            location,
            salary: salary ? String(salary) : undefined,
            source: "jsonld",
          };
        }
      }
    } catch {
      // not JobPosting JSON-LD, skip
    }
  }
  return null;
}

function extractGenericSelectors() {
  const title = firstMatch([
    "h1[class*='job-title']",
    "h1[class*='posting']",
    ".app-title", // Greenhouse
    ".posting-headline h2", // Lever
    "h1",
  ]);
  const company = firstMatch([
    "[class*='company-name']",
    ".company-name",
    "meta[property='og:site_name']",
  ]);
  if (!title) return null;
  return { title, company, source: "generic" };
}

function extractMeta() {
  const ogTitle = document
    .querySelector("meta[property='og:title']")
    ?.getAttribute("content");
  const ogSiteName = document
    .querySelector("meta[property='og:site_name']")
    ?.getAttribute("content");
  if (ogTitle) return { title: ogTitle, company: ogSiteName, source: "meta" };

  // Last resort: the browser tab title, whatever shape it's in.
  if (document.title) return { title: document.title, source: "meta" };
  return null;
}

function extract() {
  const host = location.hostname.replace(/^www\./, "");
  let result = null;

  if (host.includes("linkedin.com")) {
    result = extractLinkedIn();
  }

  if (!result || !result.company) {
    const jsonLd = extractJsonLd();
    if (jsonLd) result = { ...jsonLd, ...compact(result) };
  }

  if (!result || (!result.title && !result.company)) {
    result = extractGenericSelectors() || extractMeta();
  }

  if (!result) return null;

  // Local, non-LLM insights (tech stack / experience / seniority) computed
  // from the whole visible page text - synchronous, no network call, so
  // this adds no perceptible delay when the popup opens.
  const bodyText = document.body?.innerText || "";
  const insights =
    typeof JoblyInsights !== "undefined"
      ? JoblyInsights.analyze(bodyText)
      : { techStack: [], experience: null, seniority: null };

  return {
    title: result.title || document.title,
    company: result.company,
    location: result.location,
    salary: result.salary,
    url: location.href,
    source: result.source || host,
    techStack: insights.techStack,
    experience: insights.experience,
    seniority: insights.seniority,
  };
}

function compact(obj) {
  if (!obj) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v) out[k] = v;
  return out;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOBLY_EXTRACT") {
    try {
      sendResponse({ ok: true, data: extract() });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true;
});
