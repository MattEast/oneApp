'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SessionGuard } from '../../components/session-guard';
import {
  disconnectBank,
  getBankSyncStatus,
  initiateBankConnect,
  triggerBankSync,
  type LiveSyncStatus
} from '../../lib/api';
import { clearStoredToken } from '../../lib/auth';

type PageState = 'loading' | 'not-connected' | 'connected' | 'error';

function tokenStatusLabel(status?: string) {
  switch (status) {
    case 'valid':
      return 'Active';
    case 'expired_refreshable':
      return 'Expired (can refresh)';
    case 'expired':
      return 'Expired';
    default:
      return 'Not connected';
  }
}

function freshnessStatusLabel(status?: LiveSyncStatus['linkedDataFreshness'] extends infer T ? T extends { status: infer U } ? U : never : never) {
  switch (status) {
    case 'fresh':
      return 'Fresh';
    case 'stale':
      return 'Stale';
    case 'degraded':
      return 'Degraded';
    case 'pending_initial_sync':
      return 'Pending first sync';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Not linked';
  }
}

function freshnessDetail(freshness?: LiveSyncStatus['linkedDataFreshness']) {
  if (!freshness) {
    return '';
  }

  if (freshness.status === 'pending_initial_sync') {
    return 'Waiting for the first successful sync.';
  }

  if (freshness.status === 'degraded') {
    return 'Linked data may be out of date. Trigger a sync or reconnect if this persists.';
  }

  if (freshness.status === 'unavailable') {
    return 'Freshness cannot be verified in this environment.';
  }

  if (typeof freshness.lagMinutes === 'number') {
    return `Last successful sync ${freshness.lagMinutes} minute${freshness.lagMinutes === 1 ? '' : 's'} ago.`;
  }

  return '';
}

function BankingContent({ token }: { token: string }) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [status, setStatus] = useState<LiveSyncStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const loadStatus = useCallback(async () => {
    setError('');
    const result = await getBankSyncStatus(token);

    if (result.error) {
      setError(result.error);
      setPageState('error');
      return;
    }

    setStatus(result.data ?? null);

    if (result.data?.liveSync?.linked) {
      setPageState('connected');
    } else {
      setPageState('not-connected');
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleConnect() {
    setBusy(true);
    setError('');

    const result = await initiateBankConnect(token);

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    if (result.data?.consentUrl) {
      window.location.href = result.data.consentUrl;
    } else {
      setError('No consent URL received from the provider.');
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setSyncMessage('');
    setError('');

    const result = await triggerBankSync(token);

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    const accepted = result.data?.acceptedCount ?? 0;
    const duplicates = result.data?.duplicateCount ?? 0;
    setSyncMessage(`Sync complete: ${accepted} new transaction${accepted !== 1 ? 's' : ''}, ${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped.`);
    setBusy(false);

    await loadStatus();
  }

  async function handleDisconnect() {
    setBusy(true);
    setError('');
    setSyncMessage('');

    const result = await disconnectBank(token);

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    setStatus(null);
    setPageState('not-connected');
    setBusy(false);
  }

  function handleSignOut() {
    clearStoredToken();
    router.replace('/login');
  }

  if (pageState === 'loading') {
    return (
      <main className="banking-shell">
        <section className="banking-card">
          <p className="eyebrow">Banking</p>
          <h1 className="banking-title">Loading your banking configuration...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="banking-shell">
      <section className="banking-card">
        <div className="banking-header">
          <div>
            <p className="eyebrow">Banking</p>
            <h1 className="banking-title">
              {pageState === 'connected' ? 'Your bank is connected' : 'Connect your bank'}
            </h1>
          </div>
          <button className="secondary-button" type="button" onClick={handleSignOut}>Sign out</button>
        </div>

        {error ? (
          <div className="banking-status-card banking-status-error" role="alert">
            <p className="metric-label">Error</p>
            <p className="metric-copy">{error}</p>
          </div>
        ) : null}

        {pageState === 'not-connected' ? (
          <div className="banking-onboarding">
            <div className="info-box">
              <p style={{ margin: 0, fontWeight: 600 }}>Why connect your bank?</p>
              <p style={{ margin: '8px 0 0' }}>
                Linking your bank account lets OneApp automatically import your transactions,
                detect recurring bills, and give you an accurate picture of your spending —
                all in real time.
              </p>
            </div>

            <div className="banking-steps">
              <div className="banking-step">
                <span className="banking-step-number">1</span>
                <div>
                  <p className="banking-step-title">Authorise securely</p>
                  <p className="banking-step-desc">You&apos;ll be redirected to your bank&apos;s login page to grant read-only access.</p>
                </div>
              </div>
              <div className="banking-step">
                <span className="banking-step-number">2</span>
                <div>
                  <p className="banking-step-title">We import your data</p>
                  <p className="banking-step-desc">Transactions are synced automatically. No manual entry needed.</p>
                </div>
              </div>
              <div className="banking-step">
                <span className="banking-step-number">3</span>
                <div>
                  <p className="banking-step-title">Stay in control</p>
                  <p className="banking-step-desc">Disconnect at any time from this page. Your data stays private.</p>
                </div>
              </div>
            </div>

            <button
              className="submit-button"
              type="button"
              onClick={handleConnect}
              disabled={busy}
            >
              {busy ? 'Connecting...' : 'Connect your bank account'}
            </button>

            {!status?.liveSync?.configured ? (
              <p className="inline-note" style={{ marginTop: 12 }}>
                Bank provider is not yet configured in this environment. Contact your administrator to set up TrueLayer credentials.
              </p>
            ) : null}
          </div>
        ) : null}

        {pageState === 'connected' ? (
          <div className="banking-connected">
            <div className="banking-status-grid">
              <div className="banking-status-card">
                <p className="metric-label">Provider</p>
                <p className="metric-copy">{status?.liveSync?.provider ?? 'Unknown'}</p>
              </div>
              <div className="banking-status-card">
                <p className="metric-label">Connection status</p>
                <p className="metric-copy">{tokenStatusLabel(status?.liveSync?.tokenStatus)}</p>
              </div>
              <div className="banking-status-card">
                <p className="metric-label">Transactions synced</p>
                <p className="metric-copy">{status?.transactionCount ?? 0}</p>
              </div>
              {status?.linkedDataFreshness ? (
                <div className="banking-status-card">
                  <p className="metric-label">Data freshness</p>
                  <p className="metric-copy">{freshnessStatusLabel(status.linkedDataFreshness.status)}</p>
                  <p className="inline-note">{freshnessDetail(status.linkedDataFreshness)}</p>
                </div>
              ) : null}
              {status?.latestSync ? (
                <div className="banking-status-card">
                  <p className="metric-label">Last sync result</p>
                  <p className="metric-copy">
                    {status.latestSync.acceptedCount ?? 0} accepted, {status.latestSync.duplicateCount ?? 0} duplicates
                  </p>
                </div>
              ) : null}
            </div>

            {syncMessage ? (
              <div className="info-box" role="status">
                <p style={{ margin: 0 }}>{syncMessage}</p>
              </div>
            ) : null}

            <div className="banking-actions">
              <button
                className="submit-button"
                type="button"
                onClick={handleSync}
                disabled={busy}
              >
                {busy ? 'Syncing...' : 'Sync now'}
              </button>
              <button
                className="secondary-button banking-disconnect-button"
                type="button"
                onClick={handleDisconnect}
                disabled={busy}
              >
                Disconnect bank
              </button>
            </div>
          </div>
        ) : null}

        <div className="banking-footer">
          <Link className="secondary-button" href="/dashboard">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}

export default function BankingPage() {
  return (
    <SessionGuard>
      {(token) => <BankingContent token={token} />}
    </SessionGuard>
  );
}
