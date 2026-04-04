export const TOKEN_STORAGE_KEY = 'token';

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function hasStoredToken() {
  return Boolean(getStoredToken());
}

export function storeToken(token) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isInvalidSessionResponse(response, data) {
  return response.status === 401 || (response.status === 404 && data.error === 'User not found.');
}