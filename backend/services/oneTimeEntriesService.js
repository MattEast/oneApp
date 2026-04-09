const { getProfileByUserId } = require('../db/financialProfileStore');
const prisma = require('../db/prisma');
const { toMajorUnits, toMinorUnits } = require('../utils/money');

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
      amountMinor: toMinorUnits(amount),
      transactionDate,
      category,
      notes
    }
  };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftDate = left.transactionDate instanceof Date ? left.transactionDate.toISOString() : left.transactionDate;
    const rightDate = right.transactionDate instanceof Date ? right.transactionDate.toISOString() : right.transactionDate;
    const dateSort = rightDate.localeCompare(leftDate);

    if (dateSort !== 0) {
      return dateSort;
    }

    const leftCreated = left.createdAt instanceof Date ? left.createdAt.toISOString() : left.createdAt;
    const rightCreated = right.createdAt instanceof Date ? right.createdAt.toISOString() : right.createdAt;
    return rightCreated.localeCompare(leftCreated);
  });
}

function serializeEntry(entry) {
  const txDate = entry.transactionDate instanceof Date
    ? entry.transactionDate.toISOString().slice(0, 10)
    : entry.transactionDate;
  return {
    ...entry,
    transactionDate: txDate,
    amount: toMajorUnits(entry.amountMinor)
  };
}

async function listOneTimeEntriesForUser(userId) {
  try {
    const profile = await getProfileByUserId(userId);
    if (!profile) return [];
    return sortEntries(profile.oneTimeEntries || []).map(serializeEntry);
  } catch (err) {
    console.error('Error in listOneTimeEntriesForUser:', err);
    throw new Error('Database error');
  }
}

async function createOneTimeEntryForUser(userId, input) {
  const normalized = normalizeOneTimeEntry(input);
  if (normalized.error) {
    return normalized;
  }
  try {
    // Look up the user's profile by userId (which is the user's id/UUID)
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return { error: 'User profile not found.' };
    }
    const entry = await prisma.oneTimeEntry.create({
      data: {
        ...normalized.value,
        transactionDate: new Date(normalized.value.transactionDate + 'T00:00:00.000Z'),
        profileId: profile.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    return { value: serializeEntry(entry) };
  } catch (err) {
    console.error('Error in createOneTimeEntryForUser:', err);
    throw new Error('Database error');
  }
}

async function updateOneTimeEntryForUser(userId, entryId, input) {
  const normalized = normalizeOneTimeEntry(input);
  if (normalized.error) {
    return normalized;
  }
  try {
    const entry = await prisma.oneTimeEntry.update({
      where: { id: entryId },
      data: {
        ...normalized.value,
        transactionDate: new Date(normalized.value.transactionDate + 'T00:00:00.000Z'),
        updatedAt: new Date()
      }
    });
    return { value: serializeEntry(entry) };
  } catch (err) {
    if (err.code === 'P2025') {
      return { error: 'One-time entry not found.', statusCode: 404 };
    }
    console.error('Error in updateOneTimeEntryForUser:', err);
    return { error: 'Database error', statusCode: 500 };
  }
}

async function removeOneTimeEntryForUser(userId, entryId) {
  try {
    const entry = await prisma.oneTimeEntry.delete({
      where: { id: entryId }
    });
    return { value: entry };
  } catch (err) {
    if (err.code === 'P2025') {
      return { error: 'One-time entry not found.', statusCode: 404 };
    }
    console.error('Error in removeOneTimeEntryForUser:', err);
    return { error: 'Database error', statusCode: 500 };
  }
}

module.exports = {
  createOneTimeEntryForUser,
  listOneTimeEntriesForUser,
  removeOneTimeEntryForUser,
  updateOneTimeEntryForUser
};