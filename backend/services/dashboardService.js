const { getOrCreateFinancialProfile } = require('../data/financialStore');
const { calculateMonthlyAmount } = require('./recurringPaymentsService');
const { listRecurringObligationsForUser } = require('./recurringObligationsService');

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

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function listOneTimeEntries(profile) {
  return profile.oneTimeEntries || [];
}

function buildOneTimeTotals(profile) {
  return listOneTimeEntries(profile).reduce((totals, entry) => {
    if (entry.type === 'income') {
      totals.oneTimeIncome += entry.amount;
    } else {
      totals.oneTimeExpenses += entry.amount;
    }

    return totals;
  }, { oneTimeIncome: 0, oneTimeExpenses: 0 });
}

function buildTotals(profile) {
  const oneTimeTotals = buildOneTimeTotals(profile);
  const recurringBills = roundCurrency(
    profile.recurringPayments.reduce((total, payment) => total + calculateMonthlyAmount(payment), 0)
  );
  const flexibleSpending = roundCurrency(
    profile.flexibleCategories.reduce((total, category) => total + category.amount, 0) + oneTimeTotals.oneTimeExpenses
  );
  const income = roundCurrency(profile.monthlyIncome + oneTimeTotals.oneTimeIncome);

  return {
    income,
    recurringBills,
    flexibleSpending,
    oneTimeIncome: roundCurrency(oneTimeTotals.oneTimeIncome),
    oneTimeExpenses: roundCurrency(oneTimeTotals.oneTimeExpenses),
    availableFunds: roundCurrency(income - recurringBills - flexibleSpending)
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
    const nextAmount = roundCurrency((existing?.amount || 0) + calculateMonthlyAmount(payment));

    groupedRecurringCategories.set(payment.category, {
      name: config.name,
      amount: nextAmount,
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
      const nextAmount = roundCurrency((existing?.amount || 0) + entry.amount);

      groupedRecurringCategories.set(entry.category, {
        name: config.name,
        amount: nextAmount,
        kind: config.kind
      });
    });

  return [
    ...Array.from(groupedRecurringCategories.values()),
    ...profile.flexibleCategories
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
      const dueDay = new Date(`${entry.transactionDate}T00:00:00.000Z`).getUTCDate();

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

function buildRecurringData(profile, email) {
  const detectedObligations = listRecurringObligationsForUser(email);

  if (detectedObligations.length > 0) {
    return {
      recurringPayments: detectedObligations,
      recurringDataSource: {
        kind: 'bank_linked',
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

function buildDashboardSummary(user) {
  const displayName = user.fullname.split(' ')[0] || user.fullname;
  const profile = getOrCreateFinancialProfile(user.email);
  const recurringData = buildRecurringData(profile, user.email);
  const dashboardProfile = {
    ...profile,
    recurringPayments: recurringData.recurringPayments
  };

  return {
    user: {
      fullname: user.fullname,
      email: user.email,
      firstName: displayName
    },
    periodLabel: profile.periodLabel,
    totals: buildTotals(dashboardProfile),
    categories: buildCategorySummary(dashboardProfile),
    reminders: buildReminderSummary(dashboardProfile),
    recurringDataSource: recurringData.recurringDataSource,
    oneTimeEntries: listOneTimeEntries(profile)
  };
}

module.exports = {
  buildDashboardSummary
};