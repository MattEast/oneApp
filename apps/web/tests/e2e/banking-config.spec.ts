import { test, expect } from '@playwright/test';

const API = 'http://localhost:4000/api/v1';

function mockAuth(page: import('@playwright/test').Page) {
  return page.route(`${API}/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          token: 'pw-banking-token-1234567890abcdef',
          expiresIn: 3600,
          user: { fullname: 'Demo Customer', email: 'demo@oneapp.local' }
        }
      })
    });
  });
}

function mockDashboard(page: import('@playwright/test').Page) {
  return page.route(`${API}/dashboard-summary`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: { fullname: 'Demo Customer', email: 'demo@oneapp.local', firstName: 'Demo' },
          periodLabel: 'April 2026',
          totals: { income: 3000, recurringBills: 1200, flexibleSpending: 400, oneTimeIncome: 0, oneTimeExpenses: 0, availableFunds: 1400 },
          categories: [],
          reminders: [],
          recurringDataSource: { kind: 'prototype_seeded', detectedCount: 0, status: 'fallback' }
        }
      })
    });
  });
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('demo@oneapp.local');
  await page.getByRole('textbox', { name: /^Password$/i }).fill('DemoPass123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// --- Not-connected state ---

test('banking page shows onboarding when bank is not connected', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/live-status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          liveSync: { configured: true, provider: 'truelayer', linked: false, tokenStatus: 'none', contractVersion: '2026-04-live-sync-v1' },
          transactionCount: 0
        }
      })
    });
  });

  await signIn(page);
  await page.goto('/banking');

  await expect(page.getByRole('heading', { name: /Connect your bank/i })).toBeVisible();
  await expect(page.getByText(/Why connect your bank/i)).toBeVisible();
  await expect(page.getByText(/Authorise securely/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Connect your bank account/i })).toBeVisible();
});

// --- Connected state ---

test('banking page shows status when bank is connected', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/live-status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          liveSync: { configured: true, provider: 'truelayer', linked: true, tokenStatus: 'valid', contractVersion: '2026-04-live-sync-v1' },
          transactionCount: 42,
          linkedDataFreshness: {
            status: 'fresh',
            lagMinutes: 12,
            lastSuccessfulSyncAt: '2026-04-20T12:00:00.000Z',
            lastWebhookAt: '2026-04-20T12:05:00.000Z'
          },
          latestSync: { ingestionId: 'live:2026-04-20', source: 'bank_linked', outcome: 'success', acceptedCount: 12, duplicateCount: 3, rejectedCount: 0 }
        }
      })
    });
  });

  await signIn(page);
  await page.goto('/banking');

  await expect(page.getByRole('heading', { name: /Your bank is connected/i })).toBeVisible();
  await expect(page.getByText('truelayer')).toBeVisible();
  await expect(page.getByText('Active')).toBeVisible();
  await expect(page.getByText('42')).toBeVisible();
  await expect(page.locator('.banking-status-card .metric-copy').filter({ hasText: /^Fresh$/ })).toBeVisible();
  await expect(page.getByText(/Last successful sync 12 minutes ago/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sync now/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Disconnect bank/i })).toBeVisible();
});

// --- Disconnect ---

test('user can disconnect bank from banking page', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  let disconnectCalled = false;

  await page.route(`${API}/bank-sync/live-status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          liveSync: { configured: true, provider: 'truelayer', linked: true, tokenStatus: 'valid', contractVersion: '2026-04-live-sync-v1' },
          transactionCount: 10
        }
      })
    });
  });

  await page.route(`${API}/bank-sync/disconnect`, async (route) => {
    disconnectCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { revoked: true, provider: 'truelayer' } })
    });
  });

  await signIn(page);
  await page.goto('/banking');

  await expect(page.getByRole('heading', { name: /Your bank is connected/i })).toBeVisible();
  await page.getByRole('button', { name: /Disconnect bank/i }).click();

  await expect(page.getByRole('heading', { name: /Connect your bank/i })).toBeVisible();
  expect(disconnectCalled).toBe(true);
});

// --- Sync now ---

test('user can trigger a manual sync', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  let statusCalls = 0;

  await page.route(`${API}/bank-sync/live-status`, async (route) => {
    statusCalls++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          liveSync: { configured: true, provider: 'truelayer', linked: true, tokenStatus: 'valid', contractVersion: '2026-04-live-sync-v1' },
          transactionCount: statusCalls > 1 ? 15 : 10,
          latestSync: { acceptedCount: statusCalls > 1 ? 5 : 0, duplicateCount: statusCalls > 1 ? 2 : 0, rejectedCount: 0 }
        }
      })
    });
  });

  await page.route(`${API}/bank-sync/sync`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          syncSummary: { ingestionId: 'live:2026-04-20T12:00:00Z', source: 'bank_linked', outcome: 'success', acceptedCount: 5, duplicateCount: 2, rejectedCount: 0 },
          transactionCount: 15,
          contractVersion: '2026-04-live-sync-v1'
        }
      })
    });
  });

  await signIn(page);
  await page.goto('/banking');

  await page.getByRole('button', { name: /Sync now/i }).click();

  await expect(page.getByText(/5 new transactions/i)).toBeVisible();
  await expect(page.getByText(/2 duplicates skipped/i)).toBeVisible();
});

// --- Dashboard CTA ---

test('dashboard shows banking CTA when no bank is linked', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/live-status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          liveSync: { configured: true, provider: 'truelayer', linked: false, tokenStatus: 'none' },
          transactionCount: 0
        }
      })
    });
  });

  await signIn(page);

  await expect(page.getByText(/Connect your bank for real-time data/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Set up banking/i })).toBeVisible();
});

// --- Callback error ---

test('callback page shows error when provider declines', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);
  await signIn(page);

  await page.goto('/banking/callback?error=access_denied');

  await expect(page.getByRole('heading', { name: /Connection failed/i })).toBeVisible();
  await expect(page.getByText(/access_denied/i)).toBeVisible();
});

// --- Navigation ---

test('dashboard has a link to the banking page', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);
  await signIn(page);

  const bankingLink = page.getByRole('link', { name: /^Banking$/i });
  await expect(bankingLink).toBeVisible();
  await expect(bankingLink).toHaveAttribute('href', '/banking');
});
