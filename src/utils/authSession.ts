// Token helpers shared by DataContext and LoginScreen. Kept free of React Native imports so they can be unit-tested.

export const decodeToken = (tokenStr: string | null) => {
  if (!tokenStr) return null;
  try {
    const parts = tokenStr.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    for (let i = 0; i < base64.length; i += 4) {
      const enc1 = chars.indexOf(base64.charAt(i));
      const enc2 = chars.indexOf(base64.charAt(i + 1));
      const enc3 = chars.indexOf(base64.charAt(i + 2));
      const enc4 = chars.indexOf(base64.charAt(i + 3));
      if (enc1 === -1 || enc2 === -1) break;
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      str += String.fromCharCode(chr1);
      if (enc3 !== 64 && enc3 !== -1) {
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        str += String.fromCharCode(chr2);
      }
      if (enc4 !== 64 && enc4 !== -1) {
        const chr3 = ((enc3 & 3) << 6) | enc4;
        str += String.fromCharCode(chr3);
      }
    }
    return JSON.parse(str);
  } catch (error) {
    console.error('[DATA CONTEXT] Error decoding token:', error);
    return null;
  }
};

export const isTokenExpired = (tokenStr: string | null): boolean => {
  if (!tokenStr) return true;
  const decoded = decodeToken(tokenStr);
  if (!decoded || !decoded.exp) return false;
  // Buffer by 30 seconds
  return decoded.exp * 1000 < (Date.now() + 30000);
};

/** Refresh this long before the access token expires, so requests never go out with a stale token */
export const ACCESS_TOKEN_REFRESH_LEAD_MS = 60 * 1000;

/**
 * Milliseconds until the access token should be proactively refreshed (0 = now),
 * or null when the token has no readable expiry.
 */
export const msUntilAccessTokenRefresh = (
  tokenStr: string | null,
  now: number = Date.now(),
  leadMs: number = ACCESS_TOKEN_REFRESH_LEAD_MS
): number | null => {
  const decoded = decodeToken(tokenStr);
  if (!decoded || typeof decoded.exp !== 'number') return null;
  return Math.max(0, decoded.exp * 1000 - leadMs - now);
};

/**
 * Outcome of a refresh attempt:
 * - ok: new tokens issued
 * - invalid: the server rejected the refresh token (expired / revoked / missing) - the user must log in again
 * - transient: network or server problem - the session is still valid, so keep it and retry later
 */
export type RefreshOutcome =
  | { status: 'ok'; accessToken: string; refreshToken: string; user?: any }
  | { status: 'invalid'; reason?: string }
  | { status: 'transient'; reason?: string };

export const requestTokenRefresh = async (
  baseUrl: string,
  refreshToken: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<RefreshOutcome> => {
  if (!refreshToken) return { status: 'invalid', reason: 'No refresh token stored' };

  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (err: any) {
    return { status: 'transient', reason: err?.message || 'Network error' };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok) {
    const accessToken = data?.accessToken || data?.token;
    if (!accessToken) return { status: 'transient', reason: 'Refresh response had no access token' };
    return { status: 'ok', accessToken, refreshToken: data.refreshToken || refreshToken, user: data.user };
  }
  // Only an explicit rejection of the refresh token ends the session
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { status: 'invalid', reason: data?.code || data?.error || `HTTP ${res.status}` };
  }
  return { status: 'transient', reason: data?.error || `HTTP ${res.status}` };
};
