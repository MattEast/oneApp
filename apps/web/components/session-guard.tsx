'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { clearStoredToken } from '../lib/auth';
import { useSession } from '../lib/useSession';

type SessionGuardProps = {
  children: (token: string) => ReactNode;
};

function formatTimeRemaining(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);

  if (totalSeconds >= 60) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${totalSeconds} second${totalSeconds !== 1 ? 's' : ''}`;
}

/**
 * SessionGuard wraps authenticated page content.
 *
 * - Redirects to /login when there is no token or the token has expired.
 * - Shows a dismissible warning banner 5 minutes before expiry.
 * - Passes the valid token into children via render prop so pages never
 *   need to call getStoredToken() themselves.
 *
 * Usage:
 *   <SessionGuard>
 *     {(token) => <YourAuthenticatedPageContent token={token} />}
 *   </SessionGuard>
 */
export function SessionGuard({ children }: SessionGuardProps) {
  const router = useRouter();
  const { token, state, remainingMs, signOut } = useSession();

  useEffect(() => {
    if (state === 'missing' || state === 'expired') {
      clearStoredToken();
      router.replace('/login');
    }
  }, [state, router]);

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  if (state === 'loading') {
    return null;
  }

  if (state === 'missing' || state === 'expired') {
    return null;
  }

  return (
    <>
      {state === 'expiring-soon' && remainingMs !== null ? (
        <div className="session-warning-banner" role="alert" aria-label="Sign out now">
          <span>
            Your session expires in {formatTimeRemaining(remainingMs)}. Save any changes and sign in again to continue.
          </span>
          <button
            className="session-warning-dismiss"
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out now"
          >
            Sign out now
          </button>
        </div>
      ) : null}
      {children(token!)}
    </>
  );
}
