'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buildApiUrl, buildAuthHeaders, readJsonSafely, unwrapApiData } from '../../lib/api';
import { clearStoredToken, getStoredToken } from '../../lib/auth';

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

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tokenPreview, setTokenPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    setTokenPreview(`${token.slice(0, 18)}...`);

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
      } catch {
        setError('Unable to reach the API. Check that the backend is running.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function handleSignOut() {
    const token = getStoredToken();

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
          <section className="metric-tile">
            <p className="metric-label">Money left this month</p>
            <p className="metric-copy">{formatCurrency(summary.totals.availableFunds)}</p>
            <p className="inline-note">{getConfidenceLabel(summary.recurringDataSource?.status)}</p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Money coming in</p>
            <p className="metric-copy">{formatCurrency(summary.totals.income)}</p>
            <p className="inline-note">Reporting period: {summary.periodLabel}</p>
          </section>
          <section className="metric-tile">
            <p className="metric-label">Regular commitments</p>
            <p className="metric-copy">{formatCurrency(summary.totals.recurringBills)}</p>
            <p className="inline-note">Preview token: {tokenPreview || 'Checking session...'}</p>
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
        </div>

        <div className="auth-footer">
          <Link className="secondary-button" href="/">Back to landing page</Link>
        </div>
      </section>
    </main>
  );
}
