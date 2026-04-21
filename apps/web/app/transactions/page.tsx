'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SessionGuard } from '../../components/session-guard';
import { getTransactions, type Transaction } from '../../lib/api';
import { getStoredToken } from '../../lib/auth';

function formatCurrency(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function categoryLabel(hint?: string) {
  if (!hint) return null;
  return hint
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type Summary = {
  totalIn: number;
  totalOut: number;
  topMerchants: { name: string; amount: number }[];
};

function buildSummary(transactions: Transaction[]): Summary {
  let totalIn = 0;
  let totalOut = 0;
  const merchantMap: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.direction === 'in') {
      totalIn += tx.amount;
    } else {
      totalOut += tx.amount;
      const name = tx.merchantName || 'Unknown';
      merchantMap[name] = (merchantMap[name] || 0) + tx.amount;
    }
  }

  const topMerchants = Object.entries(merchantMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return { totalIn, totalOut, topMerchants };
}

function TransactionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    const result = await getTransactions(token);
    if (result.error) {
      setError(result.error);
    } else {
      const txs = result.data?.transactions ?? [];
      setTransactions(txs);
      setSummary(buildSummary(txs));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="metric-label" style={{ textAlign: 'center', marginTop: 48 }}>Loading transactions…</p>;
  }

  if (error) {
    return (
      <div className="metric-tile" style={{ color: 'var(--danger)', marginTop: 24 }}>
        <p>{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="metric-tile" style={{ marginTop: 24, textAlign: 'center' }}>
        <p className="metric-label">No transactions found.</p>
        <p style={{ marginTop: 8 }}>
          <Link href="/import" style={{ color: 'var(--accent)' }}>Import a bank statement</Link> to see your transactions here.
        </p>
      </div>
    );
  }

  const net = (summary!.totalIn - summary!.totalOut);

  return (
    <>
      {/* Summary metrics */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginTop: 24 }}>
        <div className="metric-tile">
          <p className="metric-label">Money In</p>
          <p className="metric-copy" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.4rem' }}>
            {formatCurrency(summary!.totalIn)}
          </p>
        </div>
        <div className="metric-tile">
          <p className="metric-label">Money Out</p>
          <p className="metric-copy" style={{ fontWeight: 700, fontSize: '1.4rem' }}>
            {formatCurrency(summary!.totalOut)}
          </p>
        </div>
        <div className="metric-tile">
          <p className="metric-label">Net</p>
          <p className="metric-copy" style={{ color: net >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700, fontSize: '1.4rem' }}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </p>
        </div>
        <div className="metric-tile">
          <p className="metric-label">Transactions</p>
          <p className="metric-copy" style={{ fontWeight: 700, fontSize: '1.4rem' }}>{transactions.length}</p>
        </div>
      </div>

      {/* Top merchants */}
      {summary!.topMerchants.length > 0 && (
        <div className="metric-tile" style={{ marginTop: 18 }}>
          <p className="metric-label" style={{ marginBottom: 14 }}>Top Spending</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {summary!.topMerchants.map((m) => {
              const pct = Math.round((m.amount / summary!.totalOut) * 100);
              return (
                <div key={m.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.95rem' }}>{m.name}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatCurrency(m.amount)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--border)' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="metric-tile" style={{ marginTop: 18, padding: 0, overflow: 'hidden' }}>
        <p className="metric-label" style={{ padding: '16px 18px 0' }}>All Transactions</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {(['Date', 'Description', 'Category', 'Amount'] as const).map((h) => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: h === 'Amount' ? 'right' : 'left', color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.transactionId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 18px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(tx.bookedAt)}</td>
                  <td style={{ padding: '11px 18px' }}>{tx.merchantName || '—'}</td>
                  <td style={{ padding: '11px 18px', color: 'var(--muted)' }}>{categoryLabel(tx.categoryHint) || '—'}</td>
                  <td style={{ padding: '11px 18px', textAlign: 'right', fontWeight: 600, color: tx.direction === 'in' ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap' }}>
                    {tx.direction === 'in' ? '+' : '−'}{formatCurrency(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  return (
    <SessionGuard>
      <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Transactions</h1>
          <Link href="/dashboard" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>← Dashboard</Link>
        </div>
        <p style={{ color: 'var(--muted)', margin: 0 }}>Imported statement activity</p>
        <TransactionsContent />
      </div>
    </SessionGuard>
  );
}
