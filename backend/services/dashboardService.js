const { getProfileByUserId } = require('../db/financialProfileStore');
const { BANK_SYNC_UNAVAILABLE_MESSAGE, isBankSyncUnavailableError } = require('../db/bankSyncStore');
const { calculateMonthlyAmountMinor } = require('./recurringPaymentsService');
const { listRecurringObligationsForUser } = require('./recurringObligationsService');
const { getLiveSyncStatus } = require('./liveBankSyncService');
const { normalizeMinorUnits, toMajorUnits } = require('../utils/money');

const CATEGORY_CONFIG = {
  housing: { name: 'Rent or mortgage', kind: 'Monthly bill' },
  household_bills: { name: 'Council tax and household bills', kind: 'Household' },
  groceries: { name: 'Groceries', kind: 'One-off expense' },
  transport: { name: 'Travel and transport', kind: 'Monthly bill' },
  travel: { name: 'Travel and transport', kind: 'One-off expense' },
  health: { name: 'Health', kind: 'One-off expense' },
  childcare: { name: 'Childcare', kind: 'One-off expense' },
  insurance: { name: 'Insurance', kind: 'Monthly bill' },
  savings: { name: 'Savings pot', kind: 'Set aside' },
  debt_repayment: { name: 'Debt repayment', kind: 'Monthly bill' },
  subscriptions: { name: 'Subscriptions', kind: 'Monthly bill' },
  other_expense: { name: 'Other one-off costs', kind: 'One-off expense' }
};

const PAYMENT_CYCLE_DAYS = 28;
const AVAILABLE_FUNDS_FORMULA_VERSION = 'available_funds_v1';
const DAILY_LIMIT_FORMULA_VERSION = 'daily_limit_v1';

function listOneTimeEntries(profile) {
  return (profile.oneTimeEntries || []).map((entry) => ({
    ...entry,
    amount: toMajorUnits(entry.amountMinor)
  }));
}

function buildOneTimeTotals(profile) {
  return listOneTimeEntries(profile).reduce((totals, entry) => {
    const amountMinor = normalizeMinorUnits(entry);

    if (entry.type === 'income') {
      totals.oneTimeIncomeMinor += amountMinor;
    } else {
      totals.oneTimeExpensesMinor += amountMinor;
    }

    return totals;
  }, { oneTimeIncomeMinor: 0, oneTimeExpensesMinor: 0 });
}

function toSafeMinorUnits(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function calculateAvailableFundsMinor({
  incomeMinor,
  recurringBillsMinor,
  flexibleSpendingMinor,
  recurringDataSource
}) {
  const safeIncomeMinor = toSafeMinorUnits(incomeMinor);
  const safeRecurringBillsMinor = toSafeMinorUnits(recurringBillsMinor);
  const safeFlexibleSpendingMinor = toSafeMinorUnits(flexibleSpendingMinor);
  const sourceStatus = recurringDataSource?.status || 'fallback';

  // Formula remains stable across active, fallback, and degraded states.
  // What changes is the confidence of recurring inputs, exposed in recurringDataSource.
  const availableFundsMinor = safeIncomeMinor - safeRecurringBillsMinor - safeFlexibleSpendingMinor;

  return {
    amountMinor: availableFundsMinor,
    sourceStatus,
    formulaVersion: AVAILABLE_FUNDS_FORMULA_VERSION
  };
}

function calculateDailySpendingLimit({ availableFundsMinor, referenceDayOfMonth }) {
  const referenceDay = referenceDayOfMonth || 1;
  const today = new Date();
  const currentDay = today.getUTCDate();
  const remainingDays = currentDay >= referenceDay
    ? PAYMENT_CYCLE_DAYS - (currentDay - referenceDay)
    : referenceDay - currentDay;

  const safeDays = Math.max(remainingDays, 1);
  const safeAvailable = Math.max(availableFundsMinor, 0);
  const dailyLimitMinor = Math.floor(safeAvailable / safeDays);

  return {
    amountMinor: dailyLimitMinor,
    remainingDays: safeDays,
    availableFundsMinor: safeAvailable,
    formulaVersion: DAILY_LIMIT_FORMULA_VERSION
  };
}

function buildTotals(profile, recurringDataSource) {
  const oneTimeTotals = buildOneTimeTotals(profile);
  const recurringBillsMinor = (profile.recurringPayments || []).reduce(
    (total, payment) => total + calculateMonthlyAmountMinor(payment),
    0
  );
  const flexibleSpendingMinor = (profile.flexibleCategories || []).reduce(
    (total, category) => total + normalizeMinorUnits(category),
    0
  ) + oneTimeTotals.oneTimeExpensesMinor;
  const incomeMinor = toSafeMinorUnits(profile.monthlyIncomeMinor) + oneTimeTotals.oneTimeIncomeMinor;
  const availableFunds = calculateAvailableFundsMinor({
    incomeMinor,
    recurringBillsMinor,
    flexibleSpendingMinor,
    recurringDataSource
  });

  return {
    income: toMajorUnits(incomeMinor),
    recurringBills: toMajorUnits(recurringBillsMinor),
    flexibleSpending: toMajorUnits(flexibleSpendingMinor),
    oneTimeIncome: toMajorUnits(oneTimeTotals.oneTimeIncomeMinor),
    oneTimeExpenses: toMajorUnits(oneTimeTotals.oneTimeExpensesMinor),
    availableFunds: toMajorUnits(availableFunds.amountMinor)
  };
}

function buildCategorySummary(profile) {
  const groupedRecurringCategories = new Map();

  profile.recurringPayments.forEach((payment) => {
    const config = CATEGORY_CONFIG[payment.category] || {
      name: payment.category,
      kind: 'Regular payment'
    };
    const existing = groupedRecurringCategories.get(payment.category);
    const nextAmountMinor = (existing?.amountMinor || 0) + calculateMonthlyAmountMinor(payment);

    groupedRecurringCategories.set(payment.category, {
      name: config.name,
      amountMinor: nextAmountMinor,
      kind: config.kind
    });
  });

  listOneTimeEntries(profile)
    .filter((entry) => entry.type === 'expense')
    .forEach((entry) => {
      const config = CATEGORY_CONFIG[entry.category] || {
        name: entry.category,
        kind: 'One-off expense'
      };
      const existing = groupedRecurringCategories.get(entry.category);
      const nextAmountMinor = (existing?.amountMinor || 0) + normalizeMinorUnits(entry);

      groupedRecurringCategories.set(entry.category, {
        name: config.name,
        amountMinor: nextAmountMinor,
        kind: config.kind
      });
    });

  return [
    ...Array.from(groupedRecurringCategories.values()).map((category) => ({
      name: category.name,
      amount: toMajorUnits(category.amountMinor),
      kind: category.kind
    })),
    ...profile.flexibleCategories.map((category) => ({
      name: category.name,
      amount: toMajorUnits(normalizeMinorUnits(category)),
      kind: category.kind
    }))
  ];
}

function buildReminderSummary(profile) {
  const referenceDay = profile.referenceDayOfMonth || 1;
  const recurringReminders = profile.recurringPayments
    .map((payment) => ({
      label: payment.label,
      dueInDays: payment.dueDay >= referenceDay
        ? payment.dueDay - referenceDay
        : PAYMENT_CYCLE_DAYS - referenceDay + payment.dueDay,
      status: 'Due soon'
    }));
  const oneTimeExpenseReminders = listOneTimeEntries(profile)
    .filter((entry) => entry.type === 'expense')
    .map((entry) => {
      const txDate = entry.transactionDate instanceof Date
        ? entry.transactionDate
        : new Date(`${entry.transactionDate}T00:00:00.000Z`);
      const dueDay = txDate.getUTCDate();

      return {
        label: entry.label,
        dueInDays: dueDay >= referenceDay
          ? dueDay - referenceDay
          : PAYMENT_CYCLE_DAYS - referenceDay + dueDay,
        status: 'Upcoming one-off item'
      };
    });

  return [...recurringReminders, ...oneTimeExpenseReminders]
    .filter((payment) => payment.dueInDays >= 0 && payment.dueInDays <= 7)
    .sort((left, right) => left.dueInDays - right.dueInDays)
    .slice(0, 3);
}

async function buildRecurringData(profile, email) {
  let detectedObligations = [];

  try {
    detectedObligations = await listRecurringObligationsForUser(email);
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return {
        recurringPayments: profile.recurringPayments,
        recurringDataSource: {
          kind: 'prototype_seeded',
          detectedCount: 0,
          status: 'degraded',
          issue: 'bank_sync_unavailable',
          message: BANK_SYNC_UNAVAILABLE_MESSAGE
        }
      };
    }

    throw error;
  }

  if (detectedObligations.length > 0) {
    const hasCsvImportSource = detectedObligations.some((obligation) => obligation.source === 'csv_import');
    const hasBankLinkedSource = detectedObligations.some((obligation) => obligation.source === 'bank_linked');

    let kind = 'bank_linked';

    if (hasCsvImportSource && hasBankLinkedSource) {
      kind = 'mixed';
    } else if (hasCsvImportSource) {
      kind = 'csv_import';
    }

    return {
      recurringPayments: detectedObligations,
      recurringDataSource: {
        kind,
        detectedCount: detectedObligations.length,
        status: 'active'
      }
    };
  }

  return {
    recurringPayments: profile.recurringPayments,
    recurringDataSource: {
      kind: 'prototype_seeded',
      detectedCount: 0,
      status: 'fallback'
    }
  };
}

async function buildDashboardSummary(user) {
  let displayName = '';
  if (user && user.fullname) {
    displayName = user.fullname.split(' ')[0] || user.fullname;
  } else {
    displayName = '';
  }
  const profile = await getProfileByUserId(user.id);
  if (!profile) {
    throw new Error('Financial profile not found for user');
  }
  const recurringData = await buildRecurringData(profile, user.email);
  const dashboardProfile = {
    ...profile,
    recurringPayments: recurringData.recurringPayments
  };
  const totals = buildTotals(dashboardProfile, recurringData.recurringDataSource);
  const dailyLimit = calculateDailySpendingLimit({
    availableFundsMinor: Math.round(totals.availableFunds * 100),
    referenceDayOfMonth: profile.referenceDayOfMonth
  });
  let linkedDataFreshness = null;

  try {
    const liveStatus = await getLiveSyncStatus(user.email);

    if (liveStatus.liveSync?.linked || liveStatus.linkedDataFreshness?.status === 'unavailable') {
      linkedDataFreshness = liveStatus.linkedDataFreshness;
    }
  } catch (error) {
    if (!isBankSyncUnavailableError(error)) {
      throw error;
    }

    linkedDataFreshness = {
      status: 'unavailable',
      lagMinutes: null,
      lastSuccessfulSyncAt: null,
      lastWebhookAt: null
    };
  }

  return {
    user: {
      fullname: user.fullname,
      email: user.email,
      firstName: displayName
    },
    periodLabel: profile.periodLabel,
    totals,
    dailySpendingLimit: {
      amount: toMajorUnits(dailyLimit.amountMinor),
      remainingDays: dailyLimit.remainingDays,
      availableFundsUsed: toMajorUnits(dailyLimit.availableFundsMinor),
      formulaVersion: dailyLimit.formulaVersion
    },
    categories: buildCategorySummary(dashboardProfile),
    reminders: buildReminderSummary(dashboardProfile),
    recurringDataSource: recurringData.recurringDataSource,
    linkedDataFreshness,
    oneTimeEntries: listOneTimeEntries(profile)
  };
}

module.exports = {
  AVAILABLE_FUNDS_FORMULA_VERSION,
  DAILY_LIMIT_FORMULA_VERSION,
  buildDashboardSummary,
  calculateAvailableFundsMinor,
  calculateDailySpendingLimit
};