function toMinorUnits(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.round(numeric * 100);
}

function toMajorUnits(minorUnits) {
  return Number((minorUnits / 100).toFixed(2));
}

function normalizeMinorUnits(input) {
  if (Number.isFinite(input.amountMinor)) {
    return Math.round(input.amountMinor);
  }

  return toMinorUnits(input.amount);
}

module.exports = {
  normalizeMinorUnits,
  toMajorUnits,
  toMinorUnits
};