/* exported JoblyCv */
// Fetches the signed-in user's CV profile (skills/years/seniority) from
// the Jobly backend and caches it in chrome.storage.local. Cached so a
// popup open never has to wait on a network round trip except the very
// first time (or after the cache expires) - the actual insights.js
// tech-stack/experience extraction is still 100% local and instant; this
// is only the "what does MY CV say" half of the match, which has to come
// from wherever the CV was uploaded (the Jobly web app).

const JoblyCv = (() => {
  const CACHE_KEY = "cvProfileCache";
  const TTL_MS = 30 * 60 * 1000; // 30 min - short enough that an edit on the web app shows up soon without thinking about it; the on-demand Refresh link covers "right now"

  async function getCached() {
    const { [CACHE_KEY]: cache } = await chrome.storage.local.get([CACHE_KEY]);
    return cache || null;
  }

  async function setCached(profile) {
    if (!profile) {
      // Don't cache "no CV yet" - the moment the user uploads one, the
      // next popup open should see it, not a stale negative result for
      // up to TTL_MS. Only a *found* profile is worth caching.
      await chrome.storage.local.remove([CACHE_KEY]);
      return;
    }
    await chrome.storage.local.set({
      [CACHE_KEY]: { profile, fetchedAt: Date.now() },
    });
  }

  function isFresh(cache) {
    return !!cache?.profile && Date.now() - cache.fetchedAt < TTL_MS;
  }

  /**
   * Returns { profile, stale } where profile is null if the user has no
   * CV on file (or isn't signed in) and stale marks a cache-only result
   * that couldn't be refreshed (e.g. offline).
   */
  async function getProfile(apiUrl) {
    const cache = await getCached();
    if (isFresh(cache)) return { profile: cache.profile, stale: false };

    const accessToken = await JoblyAuth.getValidAccessToken(apiUrl);
    if (!accessToken) return { profile: cache?.profile ?? null, stale: !!cache };

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/cv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profile = data.profile || null;
      await setCached(profile);
      return { profile, stale: false };
    } catch (err) {
      // Offline, or the request failed - fall back to whatever's cached
      // (even if stale) rather than showing nothing. Logged (not
      // swallowed) so a real auth/API failure is visible in the popup's
      // devtools console instead of silently looking like "no CV".
      console.warn("Jobly: couldn't fetch CV profile", err);
      return { profile: cache?.profile ?? null, stale: !!cache };
    }
  }

  /** Call after a fresh upload/edit on the web app so the extension
   * doesn't keep showing a stale cached profile - not currently wired to
   * anything (the extension never writes the CV itself), kept for a
   * future "refresh" button. */
  async function invalidate() {
    await chrome.storage.local.remove([CACHE_KEY]);
  }

  return { getProfile, invalidate };
})();
