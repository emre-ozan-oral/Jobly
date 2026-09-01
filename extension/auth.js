/* exported JoblyAuth */
// Shared sign-in/session logic for the Jobly extension, used by both
// popup.js and options.js. Talks to the Jobly app's own /api/auth/* routes
// (which proxy to Supabase Auth) rather than embedding Supabase's SDK, so
// signing in only needs the same "Jobly URL" the extension already stores
// - no separate Supabase project config required in the extension.
//
// Session is kept in chrome.storage.local (not sync): it's a
// short-lived credential tied to this browser, not something that needs
// to follow the user across devices, and local storage has no write-rate
// limits to worry about when refreshing.

const JoblyAuth = (() => {
  const STORAGE_KEY = "session";

  async function getStoredSession() {
    const { session } = await chrome.storage.local.get(["session"]);
    return session || null;
  }

  async function setStoredSession(session) {
    await chrome.storage.local.set({ [STORAGE_KEY]: session });
  }

  async function clearStoredSession() {
    await chrome.storage.local.remove([STORAGE_KEY]);
  }

  async function signIn(apiUrl, email, password) {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    const session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt, // unix seconds
      email: data.email,
    };
    await setStoredSession(session);
    return session;
  }

  async function signOut() {
    await clearStoredSession();
  }

  /**
   * Returns a still-valid access token, refreshing first if it's expired
   * or about to (within 60s). Returns null if there's no session, or if
   * the refresh itself fails (refresh token expired - the user needs to
   * sign in again).
   */
  async function getValidAccessToken(apiUrl) {
    const session = await getStoredSession();
    if (!session) return null;

    const nowSeconds = Date.now() / 1000;
    if (session.expiresAt && session.expiresAt - nowSeconds > 60) {
      return session.accessToken;
    }

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const refreshed = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        email: data.email,
      };
      await setStoredSession(refreshed);
      return refreshed.accessToken;
    } catch {
      // Refresh token itself is invalid/expired - clear the stale session
      // so the UI prompts a fresh sign-in instead of retrying forever.
      await clearStoredSession();
      return null;
    }
  }

  return { getStoredSession, signIn, signOut, getValidAccessToken };
})();
