const $ = (id) => document.getElementById(id);

async function loadUrl() {
  const { apiUrl } = await chrome.storage.sync.get(["apiUrl"]);
  if (apiUrl) $("apiUrl").value = apiUrl;
}

async function saveUrl() {
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  await chrome.storage.sync.set({ apiUrl });
  $("urlStatus").textContent = "Saved ✓";
  $("urlStatus").style.color = "#15803d";
}

async function testUrl() {
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  if (!apiUrl) {
    $("urlStatus").textContent = "Enter a Jobly URL first.";
    $("urlStatus").style.color = "#b91c1c";
    return;
  }
  $("urlStatus").textContent = "Testing...";
  $("urlStatus").style.color = "#18181b";
  try {
    const accessToken = await JoblyAuth.getValidAccessToken(apiUrl);
    const res = await fetch(`${apiUrl}/api/health`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (accessToken && data.tokenValid === false) {
      $("urlStatus").textContent =
        "Reached Jobly, but your session isn't valid - try signing in again.";
      $("urlStatus").style.color = "#b91c1c";
      return;
    }
    $("urlStatus").textContent =
      data.tokenValid === true ? "Connected ✓ (signed in)" : "Connected ✓";
    $("urlStatus").style.color = "#15803d";
  } catch (err) {
    $("urlStatus").textContent = `Couldn't reach Jobly: ${err.message}`;
    $("urlStatus").style.color = "#b91c1c";
  }
}

async function refreshAuthUI() {
  const session = await JoblyAuth.getStoredSession();
  if (session?.email) {
    $("signInPanel").style.display = "none";
    $("signedInPanel").style.display = "block";
    $("signedInEmail").textContent = session.email;
  } else {
    $("signInPanel").style.display = "block";
    $("signedInPanel").style.display = "none";
  }
}

async function signIn() {
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!apiUrl) {
    $("authStatus").textContent = "Set your Jobly URL above first.";
    $("authStatus").style.color = "#b91c1c";
    return;
  }
  if (!email || !password) {
    $("authStatus").textContent = "Enter your email and password.";
    $("authStatus").style.color = "#b91c1c";
    return;
  }

  $("signIn").disabled = true;
  $("authStatus").textContent = "Signing in...";
  $("authStatus").style.color = "#18181b";
  try {
    await chrome.storage.sync.set({ apiUrl });
    await JoblyAuth.signIn(apiUrl, email, password);
    $("password").value = "";
    $("authStatus").textContent = "";
    await refreshAuthUI();
  } catch (err) {
    $("authStatus").textContent = `Couldn't sign in: ${err.message}`;
    $("authStatus").style.color = "#b91c1c";
  } finally {
    $("signIn").disabled = false;
  }
}

async function signOut() {
  await JoblyAuth.signOut();
  await refreshAuthUI();
}

$("saveUrl").addEventListener("click", saveUrl);
$("testUrl").addEventListener("click", testUrl);
$("signIn").addEventListener("click", signIn);
$("signOut").addEventListener("click", signOut);

loadUrl();
refreshAuthUI();
