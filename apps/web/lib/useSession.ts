'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredToken,
  getStoredToken,
  getTokenExpiresAt,
  isTokenExpired,
  isTokenExpiringSoon,
  SESSION_WARN_BEFORE_MS
} from './auth';

export type SessionState = 'loading' | 'valid' | 'expiring-soon' | 'expired' | 'missing';

export type SessionInfo = {
  token: string | null;
  state: SessionState;
  expiresAt: number | null;
  /** Milliseconds until token expires. null if unknown. */
  remainingMs: number | null;
  signOut: () => void;
};

const POLL_INTERVAL_MS = 30_000; // re-check every 30 seconds

export function useSession(): SessionInfo {
  const [state, setState] = useState<SessionState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const refresh = useCallback(() => {
    const storedToken = getStoredToken();
    const storedExpiresAt = getTokenExpiresAt();

    if (!storedToken) {
      setState('missing');
      setToken(null);
      setExpiresAt(null);
      return;
    }

    setToken(storedToken);
    setExpiresAt(storedExpiresAt);

    if (isTokenExpired()) {
      setState('expired');
    } else if (isTokenExpiringSoon()) {
      setState('expiring-soon');
    } else {
      setState('valid');
    }
  }, []);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Also schedule a one-shot timeout to flip to 'expiring-soon' at the right moment.
  useEffect(() => {
    if (!expiresAt) return;

    const warnAt = expiresAt - SESSION_WARN_BEFORE_MS;
    const msUntilWarn = warnAt - Date.now();
    const msUntilExpiry = expiresAt - Date.now();

    if (msUntilExpiry <= 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (msUntilWarn > 0) {
      timers.push(setTimeout(() => setState('expiring-soon'), msUntilWarn));
    }

    timers.push(setTimeout(() => setState('expired'), msUntilExpiry));

    return () => timers.forEach(clearTimeout);
  }, [expiresAt]);

  function signOut() {
    clearStoredToken();
    setState('missing');
    setToken(null);
    setExpiresAt(null);
  }

  const remainingMs = expiresAt !== null ? Math.max(0, expiresAt - Date.now()) : null;

  return { token, state, expiresAt, remainingMs, signOut };
}
