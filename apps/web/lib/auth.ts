export const TOKEN_STORAGE_KEY = 'token';
export const TOKEN_EXPIRES_AT_KEY = 'token_expires_at';

/** Milliseconds before expiry at which to show the session-expiry warning banner. */
export const SESSION_WARN_BEFORE_MS = 5 * 60 * 1000; // 5 minutes

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function hasStoredToken() {
  return Boolean(getStoredToken());
}

/**
 * Store the JWT and its absolute expiry time.
 * @param token  The JWT string.
 * @param expiresInSeconds  The `expiresIn` value from the login response (seconds). Defaults to 3600.
 */
export function storeToken(token: string, expiresInSeconds = 3600) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  window.localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
}

export function getTokenExpiresAt(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(TOKEN_EXPIRES_AT_KEY);

  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isTokenExpired(): boolean {
  const expiresAt = getTokenExpiresAt();

  if (expiresAt === null) {
    // No expiry stored — treat as not expired so existing sessions degrade gracefully.
    return false;
  }

  return Date.now() >= expiresAt;
}

export function isTokenExpiringSoon(): boolean {
  const expiresAt = getTokenExpiresAt();

  if (expiresAt === null) {
    return false;
  }

  return Date.now() >= expiresAt - SESSION_WARN_BEFORE_MS && Date.now() < expiresAt;
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
}
