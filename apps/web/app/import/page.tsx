'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { SessionGuard } from '../../components/session-guard';
import {
  getImportHistory,
  uploadCsvStatement,
  type CsvImportResult,
  type SyncSummary
} from '../../lib/api';

function buildDefaultIngestionId() {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  return `import-${isoDate}`;
}

function formatDateTime(isoTimestamp?: string) {
  if (!isoTimestamp) {
    return 'Unknown time';
  }

  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function ImportContent({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [ingestionId, setIngestionId] = useState(buildDefaultIngestionId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [history, setHistory] = useState<SyncSummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    const historyResult = await getImportHistory(token);

    if (historyResult.error) {
      setError(historyResult.error);
      return;
    }

    setHistory(historyResult.data ?? []);
    setHistoryLoaded(true);
  }, [token]);

  const outcome = result?.syncSummary?.outcome ?? '';
  const acceptedCount = result?.syncSummary?.acceptedCount ?? 0;
  const duplicateCount = result?.syncSummary?.duplicateCount ?? 0;
  const rejectedCount = result?.syncSummary?.rejectedCount ?? 0;
  const outcomeLabel = useMemo(() => {
    if (outcome === 'partial_success') {
      return 'Imported with warnings';
    }

    if (outcome === 'success') {
      return 'Import completed';
    }

    return 'Import result';
  }, [outcome]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedIngestionId = ingestionId.trim();

    if (!file) {
      setError('Choose a CSV file to upload.');
      return;
    }

    if (!trimmedIngestionId) {
      setError('Reference name is required.');
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);

    const uploadResult = await uploadCsvStatement(token, file, trimmedIngestionId);

    if (uploadResult.error) {
      setError(uploadResult.error);
      setBusy(false);
      return;
    }

    setResult(uploadResult.data ?? null);
    setBusy(false);
    await loadHistory();
  }

  return (
    <main className="import-shell">
      <section className="import-card">
        <div className="import-header">
          <div>
            <p className="eyebrow">Bank statement import</p>
            <h1 className="import-title">Upload your real bank statement</h1>
            <p className="import-copy">
              Import CSV transactions directly into OneApp. Required columns are date, description, and amount.
            </p>
          </div>
        </div>

        <form className="import-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="statement-file">Statement CSV</label>
            <input
              id="statement-file"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="field-help">Max file size: 1MB. Accepted types: CSV or plain text.</p>
          </div>

          <div className="field">
            <label htmlFor="ingestion-id">Reference name</label>
            <input
              id="ingestion-id"
              type="text"
              value={ingestionId}
              onChange={(event) => setIngestionId(event.target.value)}
              placeholder="import-2026-04-20"
            />
            <p className="field-help">Use a unique reference so each statement upload is easy to identify.</p>
          </div>

          <button className="submit-button" type="submit" disabled={busy}>
            {busy ? 'Uploading...' : 'Upload statement'}
          </button>
        </form>

        {error ? <p className="error-text" role="alert">{error}</p> : null}

        {result?.syncSummary ? (
          <section className={`import-result ${outcome === 'partial_success' ? 'import-result-warning' : ''}`}>
            <p className="metric-label">{outcomeLabel}</p>
            <p className="metric-copy">
              Accepted: {acceptedCount} | Duplicates: {duplicateCount} | Rejected: {rejectedCount}
            </p>
            <p className="inline-note">Reference: {result.syncSummary.ingestionId ?? ingestionId}</p>
          </section>
        ) : null}

        <details className="import-help">
          <summary>CSV format help</summary>
          <p className="inline-note">Required columns (aliases accepted by backend):</p>
          <ul className="import-help-list">
            <li>date (or booked_at, transactionDate)</li>
            <li>description (or merchant, payee)</li>
            <li>amount (or value, transactionAmount)</li>
          </ul>
          <p className="inline-note">Negative amounts are treated as spending and positive amounts as income.</p>
        </details>

        <section className="import-history">
          <div className="import-history-header">
            <h2>Import history</h2>
            <button className="secondary-button" type="button" onClick={loadHistory}>
              {historyLoaded ? 'Refresh history' : 'Load history'}
            </button>
          </div>

          {history.length === 0 ? (
            <p className="inline-note">No CSV imports recorded yet.</p>
          ) : (
            <ul className="import-history-list">
              {history.map((entry) => (
                <li key={entry.ingestionId || entry.receivedAt}>
                  <p className="metric-copy">{entry.ingestionId ?? 'Unnamed import'}</p>
                  <p className="inline-note">
                    {formatDateTime(entry.receivedAt)} | accepted {entry.acceptedCount ?? 0}, duplicates {entry.duplicateCount ?? 0}, rejected {entry.rejectedCount ?? 0}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="auth-footer">
          <Link className="secondary-button" href="/dashboard">Back to dashboard</Link>
          <Link className="secondary-button" href="/banking">Banking</Link>
        </div>
      </section>
    </main>
  );
}

export default function ImportPage() {
  return (
    <SessionGuard>
      {(token) => <ImportContent token={token} />}
    </SessionGuard>
  );
}
