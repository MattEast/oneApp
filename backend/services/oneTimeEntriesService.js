const { getOrCreateFinancialProfile, updateFinancialProfile } = require('../data/financialStore');

const ENTRY_TYPES = new Set(['expense', 'income']);
const EXPENSE_CATEGORIES = new Set([
  'household_bills',
  'groceries',
  'travel',
  'health',
  'childcare',
  'debt_repayment',
  'other_expense'
]);
const INCOME_CATEGORIES = new Set([
  'salary_adjustment',
  'refund',
  'bonus',
  'side_income',
  'gift',
  'other_income'
]);

let oneTimeEntrySequence = 1;

function buildValidationError(message) {
  return { error: message };
}

function isValidDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function validateCategory(type, category) {
  const supportedCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return supportedCategories.has(category);
}

function normalizeOneTimeEntry(input) {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const amount = Number(input.amount);
  const transactionDate = typeof input.transactionDate === 'string' ? input.transactionDate.trim() : '';

  if (label.length < 2 || label.length > 80) {
    return buildValidationError('Label is required and must be between 2 and 80 characters.');
  }

  if (!ENTRY_TYPES.has(type)) {
    return buildValidationError('Type must be either expense or income.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return buildValidationError('Amount is required and must be greater than zero.');
  }

  if (!isValidDateOnly(transactionDate)) {
    return buildValidationError('Transaction date is required and must use YYYY-MM-DD format.');
  }

  if (!validateCategory(type, category)) {
    return buildValidationError('Category is required and must be supported for the selected entry type.');
  }

  if (notes.length > 200) {
    return buildValidationError('Notes must be 200 characters or fewer.');
  }

  return {
    value: {
      label,
      type,
      amount: Math.round(amount * 100) / 100,
      transactionDate,
      category,
      notes
    }
  };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const dateSort = right.transactionDate.localeCompare(left.transactionDate);

    if (dateSort !== 0) {
      return dateSort;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function listOneTimeEntriesForUser(email) {
  const profile = getOrCreateFinancialProfile(email);

  return sortEntries(profile.oneTimeEntries || []);
}

function createOneTimeEntryForUser(email, input) {
  const normalized = normalizeOneTimeEntry(input);

  if (normalized.error) {
    return normalized;
  }

  const timestamp = new Date().toISOString();
  const nextEntry = {
    id: `one-time-${oneTimeEntrySequence++}`,
    ...normalized.value,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  updateFinancialProfile(email, (profile) => ({
    ...profile,
    oneTimeEntries: sortEntries([...(profile.oneTimeEntries || []), nextEntry])
  }));

  return { value: nextEntry };
}

function updateOneTimeEntryForUser(email, entryId, input) {
  const normalized = normalizeOneTimeEntry(input);

  if (normalized.error) {
    return normalized;
  }

  let updatedEntry = null;

  const nextProfile = updateFinancialProfile(email, (profile) => {
    const existingEntries = profile.oneTimeEntries || [];
    const entryIndex = existingEntries.findIndex((entry) => entry.id === entryId);

    if (entryIndex === -1) {
      return profile;
    }

    updatedEntry = {
      ...existingEntries[entryIndex],
      ...normalized.value,
      updatedAt: new Date().toISOString()
    };

    const nextEntries = [...existingEntries];
    nextEntries[entryIndex] = updatedEntry;

    return {
      ...profile,
      oneTimeEntries: sortEntries(nextEntries)
    };
  });

  if (!updatedEntry || !(nextProfile.oneTimeEntries || []).some((entry) => entry.id === entryId)) {
    return { error: 'One-time entry not found.', statusCode: 404 };
  }

  return { value: updatedEntry };
}

function removeOneTimeEntryForUser(email, entryId) {
  let removedEntry = null;

  const nextProfile = updateFinancialProfile(email, (profile) => {
    const existingEntries = profile.oneTimeEntries || [];
    const entryToRemove = existingEntries.find((entry) => entry.id === entryId);

    if (!entryToRemove) {
      return profile;
    }

    removedEntry = entryToRemove;

    return {
      ...profile,
      oneTimeEntries: existingEntries.filter((entry) => entry.id !== entryId)
    };
  });

  if (!removedEntry || (nextProfile.oneTimeEntries || []).some((entry) => entry.id === entryId)) {
    return { error: 'One-time entry not found.', statusCode: 404 };
  }

  return { value: removedEntry };
}

module.exports = {
  createOneTimeEntryForUser,
  listOneTimeEntriesForUser,
  removeOneTimeEntryForUser,
  updateOneTimeEntryForUser
};