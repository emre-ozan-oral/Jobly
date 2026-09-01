/* exported JoblyConfig */
// Central place for the extension's default Jobly URL. Extensions have no
// build-time env vars the way the Next.js app does (there's no build step
// for "Load unpacked"), so the closest equivalent is a constant baked into
// the source - this is that constant. Most users never need to touch the
// URL at all: everything defaults to the deployed app below, and the
// Options page only exposes an override for people running a local dev
// server or a different deployment.

const JoblyConfig = (() => {
  const DEFAULT_API_URL = "https://jobly-puce.vercel.app";

  async function getApiUrl() {
    const { apiUrl } = await chrome.storage.sync.get(["apiUrl"]);
    return (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  }

  return { DEFAULT_API_URL, getApiUrl };
})();
