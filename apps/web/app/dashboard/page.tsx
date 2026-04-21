'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SessionGuard } from '../../components/session-guard';
import {
  buildApiUrl,
  buildAuthHeaders,
  readJsonSafely,
  unwrapApiData,
  getTransactions,
  type Transaction
} from '../../lib/api';
import { clearStoredToken } from '../../lib/auth';

type DashboardSummary = {
  user: {
    fullname: string;
    email: string;
    firstName: string;
  };
  periodLabel: string;
  totals: {
    income: number;
    recurringBills: number;
    flexibleSpending: number;
    oneTimeIncome: number;
    oneTimeExpenses: number;
    availableFunds: number;
  };
  categories: Array<{
    name: string;
    amount: number;
    kind: string;
  }>;
  reminders: Array<{
    label: string;
    dueInDays: number;
    status: string;
  }>;
  dailySpendingLimit?: {
    amount: number;
    remainingDays: number;
    availableFundsUsed: number;
    formulaVersion: string;
  };
  recurringDataSource?: {
    kind?: string;
    detectedCount?: number;
    status?: 'active' | 'fallback' | 'degraded';
    message?: string;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(value);
}

function getConfidenceLabel(status?: NonNullable<DashboardSummary['recurringDataSource']>['status']) {
  if (status === 'active') {
    return 'Linked-data confidence: high';
  }

  if (status === 'degraded') {
    return 'Linked-data confidence: degraded';
  }

  return 'Linked-data confidence: estimated';
}

function DashboardContent({ token }: { token: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(buildApiUrl('/dashboard-summary'), {
          headers: buildAuthHeaders(token)
        });
        const body = await readJsonSafely(response);

        if (response.status === 401) {
          clearStoredToken();
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          setError(body.error || 'Failed to load dashboard summary.');
          return;
        }

        setSummary(unwrapApiData<DashboardSummary>(body));

        const txResult = await getTransactions(token, 5);
        if (txResult.data) {
          setRecentTxs(txResult.data.transactions);
        }
      } catch {
        setError('Unable to reach the API. Check that the backend is running.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [token, router]);

  async function handleSignOut() {
    try {
      await fetch(buildApiUrl('/logout'), {
        method: 'POST',
        headers: buildAuthHeaders(token)
      });
    } catch {
      // Stateless logout still succeeds once the client token is removed.
    }

    clearStoredToken();
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <p className="eyebrow">Authenticated shell</p>
          <h1 className="dashboard-title">Loading your monthly snapshot...</h1>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <p className="eyebrow">Authenticated shell</p>
          <h1 className="dashboard-title">Monthly snapshot unavailable</h1>
          <p className="error-text" role="alert">{error}</p>
          <div className="auth-footer">
            <button className="secondary-button" type="button" onClick={handleSignOut}>Return to sign in</button>
          </div>
        </section>
      </main>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Authenticated shell</p>
            <h1 className="dashboard-title">Your money at a glance, {summary.user.firstName}</h1>
            <p className="dashboard-copy">
              Live dashboard summary data is now loading from the current prototype API while the wider target-stack migration stays intentionally narrow.
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={handleSignOut}>Sign out</button>
        </div>

        <div className="dashboard-grid">
          {!summary.recurringDataSource || summary.recurringDataSource.kind === 'prototype_seeded' ? (
            <section className="metric-tile banking-cta-tile">
              <p className="metric-label">Bank connection</p>
              <p className="metric-copy">Connect your bank for real-time data</p>
              <p className="inline-note">Link your bank account to automatically import transactions and detect recurring bills.</p>
              <Link className="submit-button banking-cta-button" href="/banking">Set up banking</Link>
            </section>
          ) : null}
          <section className="metric-tile">
            <p className="metric-label">Money left this month</p>
            <p className="metric-copy">{formatCurrency(summary.totals.availableFunds)}</p>
            <p className="inline-note">{getConfidenceLabel(summary.recurringDataSource?.status)}</p>
          </section>
          {summary.dailySpendingLimit ? (
            <section className="metric-tile">
              <p className="metric-label">Daily spending limit</p>
              <p className="metric-copy">{formatCurrency(summary.dailySpendingLimit.amount)}</p>
              <p className="inline-note">{summary.dailySpendingLimit.remainingDays} days left in this period</p>
            </section>
          ) : null}
          <section className="metric-tile">
            <p className="metric-label">Money coming in</p>
            <p className="metric-copy">{formatCurrency(summary.totals.income)}</p>
            <p className="inline-note">Reporting period: {summary.periodLabel}</p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Regular commitments</p>
            <p className="metric-copy">{formatCurrency(summary.totals.recurringBills)}</p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Day-to-day spending</p>
            <p className="metric-copy">{formatCurrency(summary.totals.flexibleSpending)}</p>
            <p className="inline-note">One-off entries stay in the prototype UI for now.</p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Where your money is going</p>
            <p className="metric-copy">
              {summary.categories.length > 0
                ? `${summary.categories[0].name} · ${formatCurrency(summary.categories[0].amount)}`
                : 'No categories available yet.'}
            </p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Bills due soon</p>
            <p className="metric-copy">
              {summary.reminders.length > 0
                ? `${summary.reminders[0].label} · ${summary.reminders[0].status}`
                : 'No bills or regular payments are due soon.'}
            </p>
          </section>
            {recentTxs.length > 0 && (
              <section className="metric-tile" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <p className="metric-label" style={{ margin: 0 }}>Recent activity</p>
                  <Link href="/transactions" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>View all →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentTxs.map((tx) => (
                    <div key={tx.transactionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{tx.merchantName || '—'}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', marginLeft: 10 }}>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(tx.bookedAt))}</span>
                      </div>
                      <span style={{ fontWeight: 600, color: tx.direction === 'in' ? 'var(--accent)' : 'var(--text)' }}>
                        {tx.direction === 'in' ? '+' : '−'}{new Intl.NumberFormat('en-GB', { style: 'currency', currency: tx.currency || 'GBP' }).format(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>

        <div className="auth-footer">
          <Link className="secondary-button" href="/banking">Banking</Link>
          <Link className="secondary-button" href="/import">Import statement</Link>
            <Link className="secondary-button" href="/transactions">Transactions</Link>
          <Link className="secondary-button" href="/">Back to landing page</Link>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <SessionGuard>
      {(token) => <DashboardContent token={token} />}
    </SessionGuard>
  );
}
