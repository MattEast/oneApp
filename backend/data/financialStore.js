const defaultProfile = {
  periodLabel: 'April 2026',
  referenceDayOfMonth: 1,
  monthlyIncome: 4250,
  oneTimeEntries: [],
  flexibleCategories: [
    { name: 'Groceries', amount: 340, kind: 'Flexible' },
    { name: 'Rail and bus travel', amount: 90, kind: 'Flexible' },
    { name: 'Eating out and extras', amount: 210, kind: 'Flexible' }
  ],
  recurringPayments: [
    {
      id: 'rent-home',
      label: 'Rent',
      amount: 1200,
      cadence: 'monthly',
      paymentType: 'rent',
      category: 'housing',
      dueDay: 12
    },
    {
      id: 'council-tax-home',
      label: 'Council tax',
      amount: 160,
      cadence: 'monthly',
      paymentType: 'council_tax',
      category: 'household_bills',
      dueDay: 3
    },
    {
      id: 'energy-home',
      label: 'Energy Direct Debit',
      amount: 50,
      cadence: 'monthly',
      paymentType: 'direct_debit',
      category: 'household_bills',
      dueDay: 6
    },
    {
      id: 'water-home',
      label: 'Water bill',
      amount: 35,
      cadence: 'monthly',
      paymentType: 'utility_bill',
      category: 'household_bills',
      dueDay: 15
    },
    {
      id: 'broadband-home',
      label: 'Broadband',
      amount: 35,
      cadence: 'monthly',
      paymentType: 'direct_debit',
      category: 'household_bills',
      dueDay: 18
    },
    {
      id: 'savings-transfer',
      label: 'Savings pot transfer',
      amount: 205,
      cadence: 'monthly',
      paymentType: 'standing_order',
      category: 'savings',
      dueDay: 8
    }
  ]
};

const financialProfiles = new Map();

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getOrCreateFinancialProfile(email) {
  if (!financialProfiles.has(email)) {
    financialProfiles.set(email, cloneValue(defaultProfile));
  }

  return cloneValue(financialProfiles.get(email));
}

function seedFinancialProfile(email, profile) {
  financialProfiles.set(email, cloneValue(profile));
}

function updateFinancialProfile(email, updater) {
  const currentProfile = getOrCreateFinancialProfile(email);
  const nextProfile = updater(cloneValue(currentProfile));

  financialProfiles.set(email, cloneValue(nextProfile));

  return cloneValue(nextProfile);
}

module.exports = {
  getOrCreateFinancialProfile,
  seedFinancialProfile,
  updateFinancialProfile
};