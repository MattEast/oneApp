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
          token: 'pw-import-token-1234567890abcdef',
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

test('dashboard has an import statement link', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await signIn(page);

  const importLink = page.getByRole('link', { name: /Import statement/i });
  await expect(importLink).toBeVisible();
  await expect(importLink).toHaveAttribute('href', '/import');
});

test('user can upload a CSV statement and see sync summary', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  let uploadCalled = false;

  await page.route(`${API}/bank-sync/csv-import`, async (route) => {
    uploadCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          syncSummary: {
            ingestionId: 'csv:import-2026-04-21',
            outcome: 'success',
            acceptedCount: 2,
            duplicateCount: 1,
            rejectedCount: 0
          },
          transactions: []
        }
      })
    });
  });

  await page.route(`${API}/bank-sync/import-history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          imports: [
            {
              ingestionId: 'csv:import-2026-04-21',
              receivedAt: '2026-04-21T10:30:00.000Z',
              source: 'csv_import',
              outcome: 'success',
              acceptedCount: 2,
              duplicateCount: 1,
              rejectedCount: 0
            }
          ]
        }
      })
    });
  });

  await signIn(page);
  await page.goto('/import');

  await page.locator('#statement-file').setInputFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,description,amount\n2026-04-01,Rent,-1200')
  });

  await page.getByRole('button', { name: /Upload statement/i }).click();

  expect(uploadCalled).toBe(true);
  await expect(page.getByText(/Import completed/i)).toBeVisible();
  await expect(page.getByText(/Accepted: 2/i)).toBeVisible();
  await expect(page.getByText(/Duplicates: 1/i)).toBeVisible();
  await expect(page.getByText(/Reference: csv:import-2026-04-21/i)).toBeVisible();
});

test('upload errors are shown inline', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/csv-import`, async (route) => {
    await route.fulfill({
      status: 415,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'Only CSV file type uploads are supported.'
      })
    });
  });

  await signIn(page);
  await page.goto('/import');

  await page.locator('#statement-file').setInputFiles({
    name: 'statement.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not,a,valid,csv')
  });

  await page.getByRole('button', { name: /Upload statement/i }).click();
  await expect(page.locator('.import-card .error-text[role="alert"]')).toContainText(/CSV file type uploads are supported/i);
});

test('user can load import history list', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/import-history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          imports: [
            {
              ingestionId: 'csv:csv-hist-001',
              receivedAt: '2026-04-20T09:00:00.000Z',
              source: 'csv_import',
              outcome: 'success',
              acceptedCount: 1,
              duplicateCount: 0,
              rejectedCount: 0
            }
          ]
        }
      })
    });
  });

  await signIn(page);
  await page.goto('/import');

  await page.getByRole('button', { name: /Load history/i }).click();

  await expect(page.getByText('csv:csv-hist-001')).toBeVisible();
  await expect(page.getByText(/accepted 1, duplicates 0, rejected 0/i)).toBeVisible();
});

test('partial-success import shows warning state', async ({ page }) => {
  await mockAuth(page);
  await mockDashboard(page);

  await page.route(`${API}/bank-sync/csv-import`, async (route) => {
    await route.fulfill({
      status: 207,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          syncSummary: {
            ingestionId: 'csv:import-2026-04-22',
            outcome: 'partial_success',
            acceptedCount: 3,
            duplicateCount: 0,
            rejectedCount: 2
          },
          transactions: []
        }
      })
    });
  });

  await page.route(`${API}/bank-sync/import-history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { imports: [] } })
    });
  });

  await signIn(page);
  await page.goto('/import');

  await page.locator('#statement-file').setInputFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,description,amount\n2026-04-01,Rent,-1200')
  });

  await page.getByRole('button', { name: /Upload statement/i }).click();

  await expect(page.getByText(/Imported with warnings/i)).toBeVisible();
  await expect(page.getByText(/Rejected: 2/i)).toBeVisible();
});
