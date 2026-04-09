import { test, expect } from '@playwright/test';

test('user can sign in and reach the dashboard summary shell', async ({ page }) => {
  await page.route('http://localhost:4000/api/v1/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          token: 'playwright-demo-token-1234567890',
          expiresIn: 3600,
          user: {
            fullname: 'Demo Customer',
            email: 'demo@oneapp.local'
          }
        }
      })
    });
  });

  await page.route('http://localhost:4000/api/v1/dashboard-summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            fullname: 'Demo Customer',
            email: 'demo@oneapp.local',
            firstName: 'Demo'
          },
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
            {
              name: 'Rent or mortgage',
              amount: 1200,
              kind: 'Monthly bill'
            }
          ],
          reminders: [
            {
              label: 'Council tax due',
              dueInDays: 2,
              status: 'Due soon'
            }
          ],
          recurringDataSource: {
            kind: 'prototype_seeded',
            detectedCount: 0,
            status: 'fallback'
          }
        }
      })
    });
  });

  await page.route('http://localhost:4000/api/v1/logout', async (route) => {
    await route.fulfill({
      status: 204,
      body: ''
    });
  });

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();
  await page.getByLabel('Email address').fill('demo@oneapp.local');
  await page.getByRole('textbox', { name: /^Password$/i }).fill('DemoPass123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Your money at a glance, Demo/i })).toBeVisible();
  await expect(page.getByText('£1,925')).toBeVisible();
  await expect(page.getByText(/Council tax due/i)).toBeVisible();
});
