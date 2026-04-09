const { normalizeMinorUnits, toMajorUnits } = require('../utils/money');

function calculateMonthlyAmountMinor(payment) {
  const amountMinor = normalizeMinorUnits(payment);

  if (payment.cadence === 'four_weekly') {
    return Math.round((amountMinor * 13) / 12);
  }

  if (payment.cadence === 'quarterly') {
    return Math.round(amountMinor / 3);
  }

  return amountMinor;
}

function calculateMonthlyAmount(payment) {
  return toMajorUnits(calculateMonthlyAmountMinor(payment));
}

module.exports = {
  calculateMonthlyAmountMinor,
  calculateMonthlyAmount
};