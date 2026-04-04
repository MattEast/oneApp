import { buildApiUrl, buildAuthHeaders } from './api';
import { clearStoredToken, getStoredToken } from './auth';

export function endClientSession(navigate) {
  clearStoredToken();
  navigate('/login', { replace: true });
}

export async function logoutCurrentSession() {
  if (!getStoredToken()) {
    return;
  }

  try {
    await fetch(buildApiUrl('/logout'), {
      method: 'POST',
      headers: buildAuthHeaders()
    });
  } catch (error) {
    // The current prototype uses stateless JWTs, so client-side token removal is the real logout action.
  }
}