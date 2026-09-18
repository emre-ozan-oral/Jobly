const $ = (id) => document.getElementById(id);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

let currentUrl = "";
let currentSource = "manual";
let currentSalary = "";
let joblyApiUrl = "";

async function init() {
  $("appliedDate").value = todayIso();

  // The Jobly URL always has a default (the deployed app), so signing in
  // is the only thing that actually gates saving.
  joblyApiUrl = await JoblyConfig.getApiUrl();

  const session = await JoblyAuth.getStoredSession();

  if (!session) {
    $("setupNotice").style.display = "block";
    $("save").disabled = true;
  }

  // Kicked off now, awaited later - usually resolves from cache instantly,
  // and running it alongside the page extraction below (rather than after)
  // means it adds no sequential latency to opening the popup.
  const cvPromise = session
    ? JoblyCv.getProfile(joblyApiUrl)
    : Promise.resolve({ profile: null, stale: false });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || "";

  if (!tab?.id || !/^https?:/.test(currentUrl)) {
    setStatus("Not a job page.", true);
    return;
  }

  let jobTechStack = [];
  let jobExperience = null;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "JOBLY_EXTRACT",
    });
    if (response?.ok && response.data) {
      const d = response.data;
      $("title").value = d.title || "";
      $("company").value = d.company || "";
      $("location").value = d.location || "";
      currentUrl = d.url || currentUrl;
      currentSource = d.source || "manual";
      currentSalary = d.salary || "";
      jobTechStack = d.techStack || [];
      jobExperience = d.experience || null;
      renderInsights(jobTechStack, jobExperience, d.seniority);
    }
  } catch {
    // content script not present on this page (e.g. chrome:// pages) - fine,
    // the user can still fill fields manually.
  }

  // The job link field is left blank on purpose - it's optional, and
  // "blank" means "use this tab's URL", shown as a placeholder rather than
  // a value so it's obvious the field can just be left alone.
  $("jobUrl").placeholder = currentUrl || "Defaults to this tab's URL";

  if (session) {
    const { profile } = await cvPromise;
    renderCvMatch(jobTechStack, jobExperience, profile);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// Purely local, instant (no LLM/network call) - just reflects what
// JoblyInsights already extracted synchronously in the content script.
function renderInsights(techStack, experience, seniority) {
  const hasData = (techStack && techStack.length) || experience || seniority;
  if (!hasData) return;

  const metaParts = [];
  if (experience) metaParts.push(`<b>Experience:</b> ${escapeHtml(experience)}`);
  if (seniority) metaParts.push(`<b>Level:</b> ${escapeHtml(seniority)}`);
  $("insightsMeta").innerHTML = metaParts.join(" &nbsp;·&nbsp; ");

  $("techRow").innerHTML = (techStack || [])
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  $("insights").style.display = "block";
}

function normalizeSkill(s) {
  return String(s).trim().toLowerCase();
}

// Simple set overlap between what the posting asks for (jobSkills, from
// JoblyInsights against the page text) and what's on the CV - no fuzzy
// matching, so "React" and "React.js" only line up because insights.js
// already normalizes both to the same display name.
function computeSkillMatch(jobSkills, cvSkills) {
  const cvSet = new Set((cvSkills || []).map(normalizeSkill));
  const matched = [];
  const missing = [];
  for (const skill of jobSkills || []) {
    if (cvSet.has(normalizeSkill(skill))) matched.push(skill);
    else missing.push(skill);
  }
  return { matched, missing };
}

// Pulls the first number out of an experience string like "5+ years" or
// "3-5 years" - a deliberate simplification (the lower bound of a range)
// since that's the bar a posting actually requires.
function parseRequiredYears(experienceStr) {
  if (!experienceStr) return null;
  const m = experienceStr.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// Purely local once the CV profile is in hand (fetched/cached by
// JoblyCv) - no LLM, no extra network call beyond that one profile fetch.
function renderCvMatch(jobTechStack, jobExperience, profile) {
  const el = $("cvMatch");

  if (!profile) {
    el.innerHTML = `<a class="cvLink" href="${joblyApiUrl}/settings" target="_blank">Add your CV</a> in Jobly to see a match score for this job.`;
    el.style.display = "block";
    return;
  }

  const parts = [];
  const { matched, missing } = computeSkillMatch(jobTechStack, profile.skills);
  const total = jobTechStack.length;

  if (total > 0) {
    const score = Math.round((matched.length / total) * 100);
    const color = score >= 70 ? "#15803d" : score >= 40 ? "#b45309" : "#b91c1c";
    parts.push(
      `<div class="matchScore" style="color:${color}"><b>${score}%</b> skill match <span class="dim">(${matched.length}/${total})</span></div>`
    );
  }

  const requiredYears = parseRequiredYears(jobExperience);
  if (requiredYears != null && profile.yearsExperience != null) {
    const diff = profile.yearsExperience - requiredYears;
    const fitLabel = diff >= 0 ? "Meets experience requirement ✓" : `${Math.abs(diff)}+ yr short on experience`;
    const fitColor = diff >= 0 ? "#15803d" : "#b45309";
    parts.push(
      `<div style="color:${fitColor}">${escapeHtml(fitLabel)} <span class="dim">(you: ${profile.yearsExperience}y · posting: ${requiredYears}+y)</span></div>`
    );
  }

  if (!parts.length && !matched.length && !missing.length) {
    parts.push(`<span class="dim">No skills or experience requirement detected on this posting.</span>`);
  }

  let html = parts.join("");
  if (matched.length) {
    html += `<div class="chipRow">${matched.map((s) => `<span class="chip chipGood">${escapeHtml(s)}</span>`).join("")}</div>`;
  }
  if (missing.length) {
    html += `<div class="chipRow">${missing.map((s) => `<span class="chip chipMissing">${escapeHtml(s)}</span>`).join("")}</div>`;
  }

  el.innerHTML = html;
  el.style.display = "block";
}

function setStatus(msg, isErr) {
  const el = $("statusMsg");
  el.textContent = msg;
  el.className = isErr ? "err" : "ok";
}

async function save() {
  const accessToken = await JoblyAuth.getValidAccessToken(joblyApiUrl);
  if (!accessToken) {
    setStatus("Sign in from Options first.", true);
    $("setupNotice").style.display = "block";
    $("save").disabled = true;
    return;
  }

  const manualUrl = $("jobUrl").value.trim();
  const body = {
    title: $("title").value.trim(),
    company: $("company").value.trim(),
    location: $("location").value.trim() || undefined,
    url: manualUrl || currentUrl,
    // A manually-typed link means this isn't the auto-detected posting
    // anymore, so don't tag it with the page's auto-detected source.
    source: manualUrl ? "manual" : currentSource,
    salary: currentSalary || undefined,
    appliedDate: $("appliedDate").value,
    status: $("jobStatus").value,
  };

  if (!body.title || !body.url) {
    setStatus("Job title and URL are required.", true);
    return;
  }

  $("save").disabled = true;
  setStatus("Saving...");

  try {
    const res = await fetch(`${joblyApiUrl.replace(/\/$/, "")}/api/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    setStatus(data.deduped ? "Updated existing entry ✓" : "Saved to Jobly ✓");
  } catch (err) {
    setStatus(`Couldn't save: ${err.message}`, true);
  } finally {
    $("save").disabled = false;
  }
}

$("save").addEventListener("click", save);
init();
