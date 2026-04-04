function calculateMonthlyAmount(payment) {
  if (payment.cadence === 'four_weekly') {
    return Math.round(((payment.amount * 13) / 12) * 100) / 100;
  }

  if (payment.cadence === 'quarterly') {
    return Math.round((payment.amount / 3) * 100) / 100;
  }

  return payment.amount;
}
module.exports = {
  calculateMonthlyAmount
};