import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { renderWithRouter } from '../testUtils';

const mockNavigate = jest.fn();

function createJsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body))
  });
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Dashboard UI', () => {
  beforeEach(() => {
    window.localStorage.setItem('token', 'mocktoken');
    mockNavigate.mockReset();

    const summary = {
      user: { fullname: 'Test User', email: 'test@example.com', firstName: 'Test' },
      periodLabel: 'April 2026',
      totals: {
        income: 4250,
        recurringBills: 1685,
        flexibleSpending: 640,
        oneTimeIncome: 0,
        oneTimeExpenses: 0,
        availableFunds: 1925
      },
      categories: [
        { name: 'Rent or mortgage', amount: 1200, kind: 'Monthly bill' },
        { name: 'Groceries', amount: 340, kind: 'Flexible' }
      ],
      reminders: [
        { label: 'Council tax due', dueInDays: 2, status: 'Due soon' }
      ],
      recurringDataSource: { kind: 'prototype_seeded', detectedCount: 0, status: 'fallback' }
    };
    let oneTimeEntries = [];

    global.fetch = jest.fn((url, options) => {
      const requestUrl = String(url);

      if (requestUrl.endsWith('/api/logout') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
      }

      if (requestUrl.endsWith('/api/dashboard-summary')) {
        return createJsonResponse(summary);
      }

       if (requestUrl.endsWith('/api/one-time-entries') && (!options?.method || options.method === 'GET')) {
        return createJsonResponse({ oneTimeEntries });
      }

      if (requestUrl.endsWith('/api/one-time-entries') && options?.method === 'POST') {
        const nextEntry = {
          id: `entry-${oneTimeEntries.length + 1}`,
          ...JSON.parse(options.body),
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z'
        };
        oneTimeEntries = [nextEntry, ...oneTimeEntries];
        return createJsonResponse({ oneTimeEntry: nextEntry }, 201);
      }

      if (requestUrl.includes('/api/one-time-entries/') && options?.method === 'PUT') {
        const entryId = requestUrl.split('/').pop();
        const updatedPayload = JSON.parse(options.body);
        oneTimeEntries = oneTimeEntries.map((entry) => (
          entry.id === entryId
            ? { ...entry, ...updatedPayload, updatedAt: '2026-04-02T10:00:00.000Z' }
            : entry
        ));
        const updatedEntry = oneTimeEntries.find((entry) => entry.id === entryId);

        return createJsonResponse({ oneTimeEntry: updatedEntry });
      }

      if (requestUrl.includes('/api/one-time-entries/') && options?.method === 'DELETE') {
        const entryId = requestUrl.split('/').pop();
        oneTimeEntries = oneTimeEntries.filter((entry) => entry.id !== entryId);
        return createJsonResponse({ deletedEntryId: entryId });
      }

      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    window.localStorage.clear();
  });

  it('renders the dashboard summary cards and grouped data', async () => {
    renderWithRouter(<Dashboard />);

    expect(await screen.findByText(/Your money at a glance, Test/i)).toBeInTheDocument();
    expect(await screen.findByText(/Money left this month/i)).toBeInTheDocument();
    expect(await screen.findByText(/Where your money is going/i)).toBeInTheDocument();
    expect(await screen.findByText(/Bills due soon/i)).toBeInTheDocument();
    expect(await screen.findByText(/Rent or mortgage/i)).toBeInTheDocument();
    expect(await screen.findByText(/Council tax due/i)).toBeInTheDocument();
  });

  it('shows an error message when the dashboard request fails', async () => {
    global.fetch.mockImplementationOnce(() => Promise.resolve({
      ok: false,
      status: 500,
      text: () => Promise.resolve(JSON.stringify({ error: 'Failed to load dashboard summary.' }))
    }));

    renderWithRouter(<Dashboard />);

    expect(await screen.findByText(/Monthly snapshot unavailable/i)).toBeInTheDocument();
    expect(await screen.findByText(/Failed to load dashboard summary/i)).toBeInTheDocument();
  });

  it('shows safe empty states for missing category and reminder data', async () => {
    global.fetch.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({
        user: { fullname: 'Test User', email: 'test@example.com', firstName: 'Test' },
        periodLabel: 'April 2026',
        totals: {
          income: 4250,
          recurringBills: 0,
          flexibleSpending: 0,
          oneTimeIncome: 0,
          oneTimeExpenses: 0,
          availableFunds: 4250
        },
        categories: [],
        reminders: [],
        recurringDataSource: { kind: 'prototype_seeded', detectedCount: 0, status: 'fallback' }
      }))
    }));

    renderWithRouter(<Dashboard />);

    expect(await screen.findByText(/No household categories are available yet/i)).toBeInTheDocument();
    expect(await screen.findByText(/No bills or regular payments are due soon/i)).toBeInTheDocument();
    expect(await screen.findByText(/Manual recurring-payment management has been withdrawn/i)).toBeInTheDocument();
  });

  it('shows recurring obligations as planned bank-linked work rather than an editable form', async () => {
    renderWithRouter(<Dashboard />);

    expect(await screen.findByRole('heading', { name: /Recurring obligations/i })).toBeInTheDocument();
    expect(await screen.findByText(/linked bank-account data/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Payment name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add recurring payment/i })).not.toBeInTheDocument();
  });

  it('creates, edits, and removes one-time entries from the dashboard', async () => {
    renderWithRouter(<Dashboard />);

    expect(await screen.findByRole('heading', { name: /One-off expenses and income/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Entry name/i), { target: { value: 'Boiler repair' } });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), { target: { value: '275' } });
    fireEvent.change(screen.getByLabelText(/^Date$/i), { target: { value: '2026-04-05' } });
    fireEvent.click(screen.getByRole('button', { name: /Add one-time entry/i }));

    expect(await screen.findByText(/Boiler repair/i)).toBeInTheDocument();
    expect(await screen.findByText(/Expense\s+·\s+Household bills\s+·\s+5 Apr 2026/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit Boiler repair/i }));
    fireEvent.change(screen.getByLabelText(/Entry name/i), { target: { value: 'Tax rebate' } });
    fireEvent.change(screen.getByLabelText(/Entry type/i), { target: { value: 'income' } });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText(/^Date$/i), { target: { value: '2026-04-06' } });
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'refund' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    expect(await screen.findByText(/Tax rebate/i)).toBeInTheDocument();
  expect(await screen.findByText(/Income\s+·\s+Refund\s+·\s+6 Apr 2026/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove Tax rebate/i }));

    expect(await screen.findByText(/No one-off entries have been recorded/i)).toBeInTheDocument();
  });

  it('signs the user out from the dashboard', async () => {
    renderWithRouter(<Dashboard />);

    fireEvent.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});