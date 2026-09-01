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

  const { apiUrl } = await chrome.storage.sync.get(["apiUrl"]);
  joblyApiUrl = apiUrl || "";

  const session = await JoblyAuth.getStoredSession();

  if (!joblyApiUrl || !session) {
    $("setupNotice").style.display = "block";
    $("save").disabled = true;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || "";

  if (!tab?.id || !/^https?:/.test(currentUrl)) {
    setStatus("Not a job page.", true);
    return;
  }

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
    }
  } catch {
    // content script not present on this page (e.g. chrome:// pages) - fine,
    // the user can still fill fields manually.
  }

  // The job link field is left blank on purpose - it's optional, and
  // "blank" means "use this tab's URL", shown as a placeholder rather than
  // a value so it's obvious the field can just be left alone.
  $("jobUrl").placeholder = currentUrl || "Defaults to this tab's URL";
}

function setStatus(msg, isErr) {
  const el = $("statusMsg");
  el.textContent = msg;
  el.className = isErr ? "err" : "ok";
}

async function save() {
  if (!joblyApiUrl) {
    setStatus("Set your Jobly URL in Options first.", true);
    return;
  }

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
