export interface ParsedJob {
  company?: string;
  title?: string;
  location?: string;
  salary?: string;
  source?: string;
}

function sourceFromUrl(url?: string): string {
  if (!url) return "manual";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("linkedin.")) return "linkedin";
    if (host.includes("greenhouse.")) return "greenhouse";
    if (host.includes("lever.")) return "lever";
    if (host.includes("myworkdayjobs.")) return "workday";
    if (host.includes("indeed.")) return "indeed";
    if (host.includes("ashbyhq.")) return "ashby";
    return host;
  } catch {
    return "manual";
  }
}

/**
 * Try to pull a schema.org JobPosting out of raw HTML via its JSON-LD block.
 * Many ATS pages (Greenhouse, Lever, Workday, etc.) embed this even though
 * LinkedIn generally does not for logged-out requests.
 */
function parseJsonLd(html: string): ParsedJob | null {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    try {
      const data = JSON.parse(match[1].trim());
      const candidates = Array.isArray(data) ? data : [data];
      for (const item of candidates) {
        const node =
          item["@type"] === "JobPosting"
            ? item
            : item["@graph"]?.find(
                (g: { "@type"?: string }) => g["@type"] === "JobPosting"
              );
        if (node) {
          const company =
            node.hiringOrganization?.name ||
            node.hiringOrganization?.legalName;
          const location =
            node.jobLocation?.address?.addressLocality ||
            (typeof node.jobLocation === "string" ? node.jobLocation : undefined);
          const salary =
            node.baseSalary?.value?.value ||
            (node.baseSalary?.value?.minValue &&
              `${node.baseSalary.value.minValue}-${node.baseSalary.value.maxValue} ${node.baseSalary.currency || ""}`.trim());
          return {
            title: node.title,
            company,
            location,
            salary: salary ? String(salary) : undefined,
          };
        }
      }
    } catch {
      // not valid JSON-LD, keep scanning
    }
  }
  return null;
}

/**
 * Heuristic fallback for plain pasted text (e.g. copy-pasted from a LinkedIn
 * job page, which has no accessible structured data when logged out).
 * LinkedIn job pages, when copy-pasted, typically look like:
 *   Senior Software Engineer
 *   Acme Corp · San Francisco, CA (Hybrid)
 *   ...
 */
function parsePastedText(text: string): ParsedJob {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedJob = {};
  if (lines.length === 0) return result;

  // First non-empty line is very often the job title.
  result.title = lines[0].slice(0, 200);

  // Look for "Company · Location" or "Company - Location" or "at Company"
  for (const line of lines.slice(1, 6)) {
    const dotSplit = line.split(/\s*[·•]\s*/);
    if (dotSplit.length >= 2 && !result.company) {
      result.company = dotSplit[0].slice(0, 120);
      result.location = dotSplit[1].slice(0, 120);
      continue;
    }
    const atMatch = line.match(/\bat\s+([A-Z][\w&.,' -]{1,80})/);
    if (atMatch && !result.company) {
      result.company = atMatch[1].trim();
    }
    const salaryMatch = line.match(
      /\$[\d,]+(?:K|k)?(?:\s?-\s?\$?[\d,]+(?:K|k)?)?(?:\s?\/\s?(?:yr|year|hr|hour))?/
    );
    if (salaryMatch && !result.salary) {
      result.salary = salaryMatch[0];
    }
  }

  return result;
}

export function parseJobInput(input: {
  url?: string;
  html?: string;
  text?: string;
}): ParsedJob {
  const fromHtml = input.html ? parseJsonLd(input.html) : null;
  const fromText = input.text ? parsePastedText(input.text) : {};

  return {
    title: fromHtml?.title || fromText.title,
    company: fromHtml?.company || fromText.company,
    location: fromHtml?.location || fromText.location,
    salary: fromHtml?.salary || fromText.salary,
    source: sourceFromUrl(input.url),
  };
}

export { sourceFromUrl };
