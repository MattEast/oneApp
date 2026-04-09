export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function buildAuthHeaders(token: string | null) {
  if (!token) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

export async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok ? '' : `Request failed with status ${response.status}.`,
      rawText: text
    };
  }
}

export function unwrapApiData<T>(body: ApiEnvelope<T> | T): T {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data as T;
  }

  return body as T;
}
