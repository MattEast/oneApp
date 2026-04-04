import { getStoredToken } from './auth';

export const API_BASE_URL = 'http://localhost:4000/api';

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function buildAuthHeaders() {
  return {
    Authorization: `Bearer ${getStoredToken()}`
  };
}