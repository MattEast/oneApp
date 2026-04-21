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

// --- Bank sync types ---

export type LiveSyncStatus = {
  provider?: string;
  providerDisplayName?: string;
  consent?: Record<string, unknown>;
  linkedAccount?: Record<string, unknown> | null;
  transactionCount?: number;
  latestSync?: SyncSummary;
  lastSyncAt?: string | null;
  webhookState?: {
    lastReceivedAt?: string | null;
    lastEventId?: string | null;
    lastEventType?: string | null;
    lastJobId?: string | null;
    lastFallbackPollingAt?: string | null;
    lastFallbackPollingJobId?: string | null;
  };
  liveSync?: {
    configured: boolean;
    provider: string;
    linked: boolean;
    tokenStatus: 'none' | 'valid' | 'expired_refreshable' | 'expired';
    contractVersion: string;
  };
  linkedDataFreshness?: {
    status: 'not_linked' | 'pending_initial_sync' | 'fresh' | 'stale' | 'degraded' | 'unavailable';
    lagMinutes?: number | null;
    lastSuccessfulSyncAt?: string | null;
    lastWebhookAt?: string | null;
  };
};

export type SyncSummary = {
  ingestionId?: string;
  receivedAt?: string;
  source?: string;
  outcome?: string;
  acceptedCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
};

export type ImportedTransaction = {
  transactionId?: string;
  bookedAt?: string;
  amount?: number;
  currency?: string;
  merchantName?: string;
  direction?: string;
  status?: string;
  categoryHint?: string;
};

export type CsvImportResult = {
  syncSummary?: SyncSummary;
  transactions?: ImportedTransaction[];
};

export type CsvImportHistory = {
  imports: SyncSummary[];
};

export type Transaction = {
  transactionId: string;
  bookedAt: string;
  amount: number;
  currency: string;
  merchantName: string;
  direction: 'in' | 'out';
  status: string;
  categoryHint?: string;
};

export type TransactionsResponse = {
  transactions: Transaction[];
  total: number;
};

export type BankConnectResponse = {
  consentUrl: string;
  provider: string;
  state: string;
};

export type BankCallbackResponse = {
  linked: boolean;
  provider: string;
  contractVersion?: string;
};

export type BankDisconnectResponse = {
  revoked: boolean;
  provider: string;
};

// --- Bank sync API functions ---

export async function getBankSyncStatus(token: string | null): Promise<{ data?: LiveSyncStatus; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/live-status'), {
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Failed to load bank status (${response.status}).` };
    }

    return { data: unwrapApiData<LiveSyncStatus>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function initiateBankConnect(token: string | null): Promise<{ data?: BankConnectResponse; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/connect'), {
      method: 'POST',
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Failed to start bank connection (${response.status}).` };
    }

    return { data: unwrapApiData<BankConnectResponse>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function completeBankCallback(token: string | null, code: string, state: string): Promise<{ data?: BankCallbackResponse; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/callback'), {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Bank linking failed (${response.status}).` };
    }

    return { data: unwrapApiData<BankCallbackResponse>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function triggerBankSync(token: string | null): Promise<{ data?: SyncSummary; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/sync'), {
      method: 'POST',
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Sync failed (${response.status}).` };
    }

    const result = unwrapApiData<{ syncSummary?: SyncSummary }>(body);
    return { data: result.syncSummary };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function disconnectBank(token: string | null): Promise<{ data?: BankDisconnectResponse; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/disconnect'), {
      method: 'POST',
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Disconnect failed (${response.status}).` };
    }

    return { data: unwrapApiData<BankDisconnectResponse>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function uploadCsvStatement(
  token: string | null,
  file: File,
  ingestionId: string
): Promise<{ data?: CsvImportResult; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ingestionId', ingestionId);

    const response = await fetch(buildApiUrl('/bank-sync/csv-import'), {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: formData
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `CSV import failed (${response.status}).` };
    }

    return { data: unwrapApiData<CsvImportResult>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function getImportHistory(token: string | null): Promise<{ data?: SyncSummary[]; error?: string }> {
  try {
    const response = await fetch(buildApiUrl('/bank-sync/import-history'), {
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Failed to load import history (${response.status}).` };
    }

    const result = unwrapApiData<CsvImportHistory>(body);
    return { data: result.imports || [] };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}

export async function getTransactions(token: string | null, limit?: number): Promise<{ data?: TransactionsResponse; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
      query.set('limit', String(limit));
    }

    const path = query.toString() ? `/bank-sync/transactions?${query.toString()}` : '/bank-sync/transactions';
    const response = await fetch(buildApiUrl(path), {
      headers: buildAuthHeaders(token)
    });
    const body = await readJsonSafely(response);

    if (!response.ok) {
      return { error: body.error || `Failed to load transactions (${response.status}).` };
    }

    return { data: unwrapApiData<TransactionsResponse>(body) };
  } catch {
    return { error: 'Unable to reach the API.' };
  }
}
