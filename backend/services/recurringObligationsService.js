const { getBankSyncTransactions } = require('../db/bankSyncStore');
const { calculateMonthlyAmountMinor } = require('./recurringPaymentsService');
const { toMajorUnits, toMinorUnits } = require('../utils/money');

const MIN_RECURRING_OCCURRENCES = 2;
const MIN_INTERVAL_DAYS = 20;
const MAX_INTERVAL_DAYS = 40;
const MIN_CONFIDENCE = 0.75;

function normalizeMerchantName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function differenceInDays(left, right) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((right.getTime() - left.getTime()) / msPerDay);
}

function inferCategory(transaction) {
  const hint = (transaction.categoryHint || '').toLowerCase();
  const merchant = normalizeMerchantName(transaction.merchantName);

  if (hint) {
    return hint;
  }

  if (merchant.includes('rent') || merchant.includes('home')) {
    return 'housing';
  }

  if (merchant.includes('council') || merchant.includes('energy') || merchant.includes('water') || merchant.includes('broadband')) {
    return 'household_bills';
  }

  if (merchant.includes('insurance')) {
    return 'insurance';
  }

  if (merchant.includes('savings')) {
    return 'savings';
  }

  return 'household_bills';
}

function inferPaymentType(transaction, category) {
  const merchant = normalizeMerchantName(transaction.merchantName);

  if (category === 'housing') {
    return 'rent';
  }

  if (merchant.includes('council')) {
    return 'council_tax';
  }

  if (merchant.includes('water') || merchant.includes('energy') || merchant.includes('broadband') || merchant.includes('utility')) {
    return 'utility_bill';
  }

  if (category === 'savings') {
    return 'standing_order';
  }

  return 'direct_debit';
}

function getCadence(intervals) {
  const averageInterval = intervals.reduce((total, value) => total + value, 0) / intervals.length;

  if (averageInterval <= 29) {
    return 'four_weekly';
  }

  return 'monthly';
}

function inferObligationSource(transactions) {
  const allCsvSourced = transactions.every((transaction) => `${transaction.transactionId || ''}`.toLowerCase().startsWith('csv_'));
  return allCsvSourced ? 'csv_import' : 'bank_linked';
}

function buildConfidence(transactions) {
  const averageAmountMinor = transactions.reduce(
    (total, transaction) => total + toMinorUnits(transaction.amount),
    0
  ) / transactions.length;
  const maxVariance = transactions.reduce((currentMax, transaction) => {
    const variance = Math.abs(toMinorUnits(transaction.amount) - averageAmountMinor) / averageAmountMinor;
    return Math.max(currentMax, variance);
  }, 0);

  if (maxVariance <= 0.01) {
    return 0.95;
  }

  if (maxVariance <= 0.05) {
    return 0.85;
  }

  if (maxVariance <= 0.1) {
    return 0.75;
  }

  return 0.6;
}

function detectRecurringObligationsFromTransactions(transactions) {
  const bookedOutgoingTransactions = transactions.filter((transaction) => transaction.direction === 'out' && transaction.status === 'booked');
  const groups = new Map();

  bookedOutgoingTransactions.forEach((transaction) => {
    const groupKey = `${normalizeMerchantName(transaction.merchantName)}|${inferCategory(transaction)}`;
    const existing = groups.get(groupKey) || [];
    existing.push(transaction);
    groups.set(groupKey, existing);
  });

  return Array.from(groups.entries())
    .map(([groupKey, groupedTransactions]) => {
      if (groupedTransactions.length < MIN_RECURRING_OCCURRENCES) {
        return null;
      }

      const sortedTransactions = groupedTransactions
        .slice()
        .sort((left, right) => new Date(left.bookedAt) - new Date(right.bookedAt));
      const intervals = [];

      for (let index = 1; index < sortedTransactions.length; index += 1) {
        intervals.push(differenceInDays(new Date(sortedTransactions[index - 1].bookedAt), new Date(sortedTransactions[index].bookedAt)));
      }

      if (intervals.some((interval) => interval < MIN_INTERVAL_DAYS || interval > MAX_INTERVAL_DAYS)) {
        return null;
      }

      const confidence = buildConfidence(sortedTransactions);

      if (confidence < MIN_CONFIDENCE) {
        return null;
      }

      const mostRecentTransaction = sortedTransactions[sortedTransactions.length - 1];
      const category = inferCategory(mostRecentTransaction);
      const paymentType = inferPaymentType(mostRecentTransaction, category);
      const cadence = getCadence(intervals);
      const source = inferObligationSource(sortedTransactions);
      const averageAmountMinor = Math.round(
        sortedTransactions.reduce((total, transaction) => total + toMinorUnits(transaction.amount), 0) / sortedTransactions.length
      );
      const monthlyAmountMinor = calculateMonthlyAmountMinor({ amountMinor: averageAmountMinor, cadence });

      return {
        id: `detected-${groupKey}`,
        label: mostRecentTransaction.merchantName,
        amountMinor: averageAmountMinor,
        amount: toMajorUnits(averageAmountMinor),
        cadence,
        paymentType,
        category,
        dueDay: new Date(mostRecentTransaction.bookedAt).getUTCDate(),
        monthlyAmountMinor,
        monthlyAmount: toMajorUnits(monthlyAmountMinor),
        confidence,
        occurrenceCount: sortedTransactions.length,
        source,
        sourceTransactionIds: sortedTransactions.map((transaction) => transaction.transactionId),
        lastSeenAt: mostRecentTransaction.bookedAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.monthlyAmountMinor - left.monthlyAmountMinor);
}

async function listRecurringObligationsForUser(email) {
  return detectRecurringObligationsFromTransactions(await getBankSyncTransactions(email));
}

module.exports = {
  detectRecurringObligationsFromTransactions,
  listRecurringObligationsForUser
};