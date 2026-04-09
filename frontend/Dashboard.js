import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';
import { buildApiUrl, buildAuthHeaders, unwrapApiData } from './api';
import { isInvalidSessionResponse } from './auth';
import { endClientSession, logoutCurrentSession } from './session';

async function readJsonSafely(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    return {
      error: response.ok ? '' : `Request failed with status ${response.status}.`,
      rawText: text
    };
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(value);
}

function formatDueText(days) {
  if (days <= 0) {
    return 'Due today';
  }

  if (days === 1) {
    return '1 day remaining';
  }

  return `${days} days remaining`;
}

const ENTRY_CATEGORY_OPTIONS = {
  expense: [
    { value: 'household_bills', label: 'Household bills' },
    { value: 'groceries', label: 'Groceries' },
    { value: 'travel', label: 'Travel' },
    { value: 'health', label: 'Health' },
    { value: 'childcare', label: 'Childcare' },
    { value: 'debt_repayment', label: 'Debt repayment' },
    { value: 'other_expense', label: 'Other one-off cost' }
  ],
  income: [
    { value: 'salary_adjustment', label: 'Salary adjustment' },
    { value: 'refund', label: 'Refund' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'side_income', label: 'Side income' },
    { value: 'gift', label: 'Gift' },
    { value: 'other_income', label: 'Other one-off income' }
  ]
};

function buildInitialEntryForm() {
  return {
    label: '',
    type: 'expense',
    amount: '',
    transactionDate: '',
    category: ENTRY_CATEGORY_OPTIONS.expense[0].value,
    notes: ''
  };
}

function formatEntryDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getCategoryLabel(type, category) {
  const option = (ENTRY_CATEGORY_OPTIONS[type] || []).find((candidate) => candidate.value === category);

  return option ? option.label : category;
}

function getAvailableFundsConfidence(recurringDataSource) {
  if (recurringDataSource?.kind === 'bank_linked' && recurringDataSource?.status === 'active') {
    return {
      tone: 'active',
      label: 'Linked-data confidence: high',
      note: 'Available funds reflect detected linked recurring obligations and recorded one-off entries.'
    };
  }

  if (recurringDataSource?.status === 'degraded') {
    return {
      tone: 'degraded',
      label: 'Linked-data confidence: degraded',
      note: recurringDataSource.message || 'Linked recurring data is temporarily unavailable. Using safe fallback recurring totals.'
    };
  }

  return {
    tone: 'fallback',
    label: 'Linked-data confidence: estimated',
    note: 'Available funds currently use prototype recurring data plus recorded one-off entries.'
  };
}

function getRecurringSectionCopy(recurringDataSource) {
  if (recurringDataSource?.kind === 'bank_linked' && recurringDataSource?.status === 'active') {
    return {
      badge: 'Live linked data',
      body: 'Recurring obligations are being detected from linked bank-account transactions and shown as read-only in this prototype.'
    };
  }

  if (recurringDataSource?.status === 'degraded') {
    return {
      badge: 'Degraded fallback',
      body: recurringDataSource.message || 'Linked recurring data is temporarily unavailable. Monthly totals currently use prototype fallback recurring data.'
    };
  }

  return {
    badge: 'Prototype fallback',
    body: 'Monthly totals and due-soon reminders currently use the seeded prototype recurring profile while linked-data evidence is still being built.'
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [oneTimeEntries, setOneTimeEntries] = useState([]);
  const [error, setError] = useState('');
  const [entryError, setEntryError] = useState('');
  const [entryStatusMessage, setEntryStatusMessage] = useState('');
  const [entryFormError, setEntryFormError] = useState('');
  const [entryForm, setEntryForm] = useState(buildInitialEntryForm());
  const [editingEntryId, setEditingEntryId] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [loading, setLoading] = useState(true);

  async function handleSignOut() {
    await logoutCurrentSession();
    endClientSession(navigate);
  }

  async function loadDashboard() {
    setLoading(true);
    setError('');
    setEntryError('');

    try {
      const [summaryResponse, entriesResponse] = await Promise.all([
        fetch(buildApiUrl('/dashboard-summary'), { headers: buildAuthHeaders() }),
        fetch(buildApiUrl('/one-time-entries'), { headers: buildAuthHeaders() })
      ]);
      const [summaryData, entriesData] = await Promise.all([
        readJsonSafely(summaryResponse),
        readJsonSafely(entriesResponse)
      ]);

      if (isInvalidSessionResponse(summaryResponse, summaryData)) {
        endClientSession(navigate);
        return;
      }

      if (isInvalidSessionResponse(entriesResponse, entriesData)) {
        endClientSession(navigate);
        return;
      }

      if (!summaryResponse.ok) {
        setError(summaryData.error || 'Failed to load dashboard summary.');
        setLoading(false);
        return;
      }

      setSummary(unwrapApiData(summaryData));

      if (!entriesResponse.ok) {
        setOneTimeEntries([]);
        setEntryError(entriesData.error || 'Failed to load one-time entries.');
      } else {
        const entries = unwrapApiData(entriesData);
        setOneTimeEntries(entries.oneTimeEntries || []);
      }
    } catch (fetchError) {
      setError('Unable to reach the API. Check that the backend is running.');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [navigate]);

  function handleEntryFieldChange(event) {
    const { name, value } = event.target;

    setEntryForm((currentForm) => {
      if (name !== 'type') {
        return {
          ...currentForm,
          [name]: value
        };
      }

      return {
        ...currentForm,
        type: value,
        category: ENTRY_CATEGORY_OPTIONS[value][0].value
      };
    });
  }

  function resetEntryForm() {
    setEditingEntryId('');
    setEntryForm(buildInitialEntryForm());
    setEntryFormError('');
    setEntryStatusMessage('Entry form reset.');
  }

  async function handleEntrySubmit(event) {
    event.preventDefault();
    setSubmittingEntry(true);
    setEntryFormError('');
    setEntryError('');
    setEntryStatusMessage('');

    try {
      const response = await fetch(
        buildApiUrl(editingEntryId ? `/one-time-entries/${editingEntryId}` : '/one-time-entries'),
        {
          method: editingEntryId ? 'PUT' : 'POST',
          headers: {
            ...buildAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...entryForm,
            amount: Number(entryForm.amount)
          })
        }
      );
      const responseData = await readJsonSafely(response);

      if (isInvalidSessionResponse(response, responseData)) {
        endClientSession(navigate);
        return;
      }

      if (!response.ok) {
        setEntryFormError(responseData.error || 'Unable to save one-time entry.');
        return;
      }

      resetEntryForm();
      setEntryStatusMessage(editingEntryId ? 'One-time entry updated.' : 'One-time entry added.');
      await loadDashboard();
    } catch (submitError) {
      setEntryFormError('Unable to save one-time entry right now.');
    } finally {
      setSubmittingEntry(false);
    }
  }

  function handleEditEntry(entry) {
    setEditingEntryId(entry.id);
    setEntryForm({
      label: entry.label,
      type: entry.type,
      amount: String(entry.amount),
      transactionDate: entry.transactionDate,
      category: entry.category,
      notes: entry.notes || ''
    });
    setEntryFormError('');
    setEntryStatusMessage(`Editing ${entry.label}.`);
  }

  async function handleDeleteEntry(entryId) {
    setSubmittingEntry(true);
    setEntryFormError('');
    setEntryError('');
    setEntryStatusMessage('');

    try {
      const response = await fetch(buildApiUrl(`/one-time-entries/${entryId}`), {
        method: 'DELETE',
        headers: buildAuthHeaders()
      });
      const responseData = await readJsonSafely(response);

      if (isInvalidSessionResponse(response, responseData)) {
        endClientSession(navigate);
        return;
      }

      if (!response.ok) {
        setEntryError(responseData.error || 'Unable to remove one-time entry.');
        return;
      }

      if (editingEntryId === entryId) {
        resetEntryForm();
      }

      setEntryStatusMessage('One-time entry removed.');
      await loadDashboard();
    } catch (deleteError) {
      setEntryError('Unable to remove one-time entry right now.');
    } finally {
      setSubmittingEntry(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-shell" aria-live="polite">
        <div className="dashboard-panel">
          <p className="dashboard-kicker">This month</p>
          <h1 className="dashboard-title">Loading your monthly snapshot...</h1>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-panel">
          <p className="dashboard-kicker">This month</p>
          <h1 className="dashboard-title">Monthly snapshot unavailable</h1>
          <p className="dashboard-error" role="alert">{error}</p>
        </div>
      </main>
    );
  }

  const availableFundsConfidence = getAvailableFundsConfidence(summary.recurringDataSource);
  const recurringSectionCopy = getRecurringSectionCopy(summary.recurringDataSource);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-panel">
        <div className="dashboard-header-row">
          <div>
            <p className="dashboard-kicker">This month</p>
            <h1 className="dashboard-title">Your money at a glance, {summary.user.firstName}</h1>
            <p className="dashboard-subtitle">
              See what is coming in, what is already committed, and what still needs attention in {summary.periodLabel}.
            </p>
          </div>
          <div className="dashboard-actions">
            <Link className="dashboard-link" to="/account">Your details</Link>
            <button className="dashboard-secondary-action" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <div className="metric-grid" aria-label="Financial summary">
          <section className="metric-card">
            <p className="metric-label">Money left this month</p>
            <p className="metric-value">{formatCurrency(summary.totals.availableFunds)}</p>
            <p className={`metric-confidence-badge metric-confidence-${availableFundsConfidence.tone}`}>{availableFundsConfidence.label}</p>
            <p className="metric-note">{availableFundsConfidence.note}</p>
          </section>
          <section className="metric-card">
            <p className="metric-label">Money coming in</p>
            <p className="metric-value">{formatCurrency(summary.totals.income)}</p>
            <p className="metric-note">Expected income recorded for this month, including one-off income items.</p>
          </section>
          <section className="metric-card">
            <p className="metric-label">Bills and regular payments</p>
            <p className="metric-value">{formatCurrency(summary.totals.recurringBills)}</p>
            <p className="metric-note">Direct Debits, standing orders and other committed payments.</p>
          </section>
          <section className="metric-card">
            <p className="metric-label">Day-to-day spending</p>
            <p className="metric-value">{formatCurrency(summary.totals.flexibleSpending)}</p>
            <p className="metric-note">Groceries, travel, and one-off spending that affects this month.</p>
          </section>
        </div>

        <div className="dashboard-columns">
          <section className="dashboard-section">
            <div className="section-header-row">
              <h2>Where your money is going</h2>
              <span>{summary.categories.length} groups</span>
            </div>
            {summary.categories.length === 0 ? (
              <p className="empty-state">No household categories are available yet.</p>
            ) : (
              <ul className="summary-list">
                {summary.categories.map((category) => (
                  <li key={category.name} className="summary-list-item">
                    <div>
                      <p className="summary-name">{category.name}</p>
                      <p className="summary-meta">{category.kind}</p>
                    </div>
                    <strong>{formatCurrency(category.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section">
            <div className="section-header-row">
              <h2>Bills due soon</h2>
              <span>{summary.reminders.length} items</span>
            </div>
            {summary.reminders.length === 0 ? (
              <p className="empty-state">No bills or regular payments are due soon.</p>
            ) : (
              <ul className="summary-list">
                {summary.reminders.map((reminder) => (
                  <li key={reminder.label} className="summary-list-item">
                    <div>
                      <p className="summary-name">{reminder.label}</p>
                      <p className="summary-meta">{reminder.status}</p>
                    </div>
                    <strong>{formatDueText(reminder.dueInDays)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="dashboard-section recurring-payments-section">
          <div className="section-header-row">
            <div>
              <h2>Recurring obligations</h2>
              <p className="section-description">Manual recurring-payment management has been withdrawn while this journey is redesigned around linked bank-account data.</p>
            </div>
            <span>{recurringSectionCopy.badge}</span>
          </div>

          <p className="empty-state">
            {recurringSectionCopy.body}
          </p>
        </section>

        <section className="dashboard-section one-time-entries-section">
          <div className="section-header-row">
            <div>
              <h2>One-off expenses and income</h2>
              <p className="section-description">Record one-off costs and extra income so the monthly snapshot stays current.</p>
            </div>
            <span>{oneTimeEntries.length} items</span>
          </div>

          <p className="sr-only" role="status" aria-live="polite">{entryStatusMessage}</p>

          <form className="one-time-entry-form" onSubmit={handleEntrySubmit} aria-busy={submittingEntry}>
            <div className="one-time-entry-grid">
              <div>
                <label htmlFor="entry-label">Entry name</label>
                <input id="entry-label" name="label" type="text" value={entryForm.label} onChange={handleEntryFieldChange} required />
              </div>
              <div>
                <label htmlFor="entry-type">Entry type</label>
                <select id="entry-type" name="type" value={entryForm.type} onChange={handleEntryFieldChange}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label htmlFor="entry-amount">Amount</label>
                <input id="entry-amount" name="amount" type="number" min="0.01" step="0.01" value={entryForm.amount} onChange={handleEntryFieldChange} required />
              </div>
              <div>
                <label htmlFor="entry-date">Date</label>
                <input id="entry-date" name="transactionDate" type="date" value={entryForm.transactionDate} onChange={handleEntryFieldChange} required />
              </div>
              <div>
                <label htmlFor="entry-category">Category</label>
                <select id="entry-category" name="category" value={entryForm.category} onChange={handleEntryFieldChange}>
                  {ENTRY_CATEGORY_OPTIONS[entryForm.type].map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="one-time-entry-notes">
                <label htmlFor="entry-notes">Notes</label>
                <input id="entry-notes" name="notes" type="text" value={entryForm.notes} onChange={handleEntryFieldChange} maxLength={200} />
              </div>
            </div>

            {entryFormError ? <p className="dashboard-error" role="alert">{entryFormError}</p> : null}

            <div className="one-time-entry-actions">
              <button className="register-btn one-time-entry-submit" type="submit" disabled={submittingEntry}>
                {editingEntryId ? 'Save changes' : 'Add one-time entry'}
              </button>
              {editingEntryId ? (
                <button className="dashboard-secondary-action" type="button" onClick={resetEntryForm} disabled={submittingEntry}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          {entryError ? <p className="dashboard-error" role="alert">{entryError}</p> : null}

          {oneTimeEntries.length === 0 ? (
            <p className="empty-state">No one-off entries have been recorded for this month yet.</p>
          ) : (
            <ul className="summary-list one-time-entry-list">
              {oneTimeEntries.map((entry) => (
                <li key={entry.id} className="summary-list-item one-time-entry-item">
                  <div>
                    <p className="summary-name">{entry.label}</p>
                    <p className="summary-meta">
                      {entry.type === 'income' ? 'Income' : 'Expense'}
                      {' · '}
                      {getCategoryLabel(entry.type, entry.category)}
                      {' · '}
                      {formatEntryDate(entry.transactionDate)}
                    </p>
                    {entry.notes ? <p className="entry-notes-text">{entry.notes}</p> : null}
                  </div>
                  <div className="one-time-entry-item-actions">
                    <strong>{entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}</strong>
                    <div className="one-time-entry-button-row">
                      <button className="dashboard-secondary-action" type="button" onClick={() => handleEditEntry(entry)} disabled={submittingEntry} aria-label={`Edit ${entry.label}`}>
                        Edit
                      </button>
                      <button className="dashboard-secondary-action" type="button" onClick={() => handleDeleteEntry(entry.id)} disabled={submittingEntry} aria-label={`Remove ${entry.label}`}>
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}