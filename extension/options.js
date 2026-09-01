const $ = (id) => document.getElementById(id);

async function load() {
  const { apiUrl, apiKey } = await chrome.storage.sync.get([
    "apiUrl",
    "apiKey",
  ]);
  if (apiUrl) $("apiUrl").value = apiUrl;
  if (apiKey) $("apiKey").value = apiKey;
}

async function save() {
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  const apiKey = $("apiKey").value.trim();
  await chrome.storage.sync.set({ apiUrl, apiKey });
  $("status").textContent = "Saved ✓";
  $("status").style.color = "#15803d";
}

async function test() {
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  const apiKey = $("apiKey").value.trim();
  if (!apiUrl) {
    $("status").textContent = "Enter a Jobly URL first.";
    $("status").style.color = "#b91c1c";
    return;
  }
  $("status").textContent = "Testing...";
  $("status").style.color = "#18181b";
  try {
    const res = await fetch(`${apiUrl}/api/health`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.tokenValid === false) {
      $("status").textContent = "Reached Jobly, but that token isn't valid.";
      $("status").style.color = "#b91c1c";
      return;
    }
    $("status").textContent =
      data.tokenValid === true ? "Connected ✓ (token valid)" : "Connected ✓";
    $("status").style.color = "#15803d";
  } catch (err) {
    $("status").textContent = `Couldn't reach Jobly: ${err.message}`;
    $("status").style.color = "#b91c1c";
  }
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", test);
load();
