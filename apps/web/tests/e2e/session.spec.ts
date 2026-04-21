import { test, expect } from '@playwright/test';

const API = 'http://localhost:4000/api/v1';

const VALID_TOKEN = 'pw-session-token-1234567890abcdef';
const EXPIRED_TOKEN = 'pw-expired-session-token-1234567890';

function mockLogin(page: import('@playwright/test').Page, token: string, expiresIn = 3600) {
  return page.route(`${API}/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          token,
          expiresIn,
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

// --- Token is stored with expiry on login ---

test('token expiry is stored in localStorage after login', async ({ page }) => {
  await mockLogin(page, VALID_TOKEN, 3600);
  await mockDashboard(page);

  await page.goto('/login');
  await page.getByLabel('Email address').fill('demo@oneapp.local');
  await page.getByRole('textbox', { name: /^Password$/i }).fill('DemoPass123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const expiresAt = await page.evaluate(() => localStorage.getItem('token_expires_at'));
  expect(expiresAt).not.toBeNull();

  const expiresAtMs = Number(expiresAt);
  expect(expiresAtMs).toBeGreaterThan(Date.now());
  // Should be roughly 1 hour from now (within 10 seconds tolerance)
  expect(expiresAtMs).toBeLessThan(Date.now() + 3610 * 1000);
});

// --- Expired token redirects to login ---

test('visiting dashboard with an expired token redirects to login', async ({ page }) => {
  await mockDashboard(page);

  // Pre-seed localStorage with an already-expired token
  await page.goto('/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    // expired 1 minute ago
    localStorage.setItem('token_expires_at', String(Date.now() - 60_000));
  }, EXPIRED_TOKEN);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

// --- No token redirects to login ---

test('visiting dashboard without a token redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

// --- Session expiry warning banner ---

test('session warning banner is shown when token is expiring soon', async ({ page }) => {
  await mockDashboard(page);

  // Pre-seed localStorage with token expiring in 2 minutes (within 5-minute warn window)
  await page.goto('/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('token_expires_at', String(Date.now() + 2 * 60 * 1000));
  }, VALID_TOKEN);

  await page.goto('/dashboard');

  await expect(page.getByRole('alert', { name: /sign out now/i })).toBeVisible();
  await expect(page.getByText(/Your session expires in/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign out now/i })).toBeVisible();
});

// --- Sign out from warning banner ---

test('clicking sign out on the warning banner redirects to login', async ({ page }) => {
  await mockDashboard(page);

  await page.route(`${API}/logout`, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('token_expires_at', String(Date.now() + 2 * 60 * 1000));
  }, VALID_TOKEN);

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Sign out now/i })).toBeVisible();
  await page.getByRole('button', { name: /Sign out now/i }).click();

  await expect(page).toHaveURL(/\/login$/);
});

// --- Banking page also protected ---

test('visiting banking page with expired token redirects to login', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('token_expires_at', String(Date.now() - 60_000));
  }, EXPIRED_TOKEN);

  await page.goto('/banking');
  await expect(page).toHaveURL(/\/login$/);
});
