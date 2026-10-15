/** Login may resume a local OAuth request, never navigate to an external URL. */
export function safeLoginRedirect(candidate: string | null | undefined, fallback = '/dashboard'): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(candidate)) return fallback;
  try {
    const base = 'https://login.invalid';
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base || parsed.username || parsed.password) return fallback;
    const normalized = parsed.pathname + parsed.search + parsed.hash;
    // Dot-segment normalization can turn an initially local path into //host.
    if (normalized.startsWith('//') || new URL(normalized, base).origin !== base) return fallback;
    return normalized;
  } catch { return fallback; }
}

let oauthNavigationStarted = false;
/** Desktop/mobile login forms share one document-navigation owner. A successful
 * OAuth document navigation unloads this module and its one-shot latch. */
export function resumeOAuthLogin(candidate: string, navigate: (path: string) => void): void {
  const path = safeLoginRedirect(candidate);
  if (!path.startsWith('/api/insights-mcp/oauth/authorize?') || oauthNavigationStarted) return;
  oauthNavigationStarted = true;
  try { navigate(path); } catch (error) { oauthNavigationStarted = false; throw error; }
}
