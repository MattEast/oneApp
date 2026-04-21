// backend/db/financialProfileStore.js
// Financial profile persistence using Prisma/PostgreSQL

const prisma = require('./prisma');

async function getProfileByUserId(userId, options = {}) {
  if (!userId) {
    return null;
  }
  try {
    // Allow caller to specify which relations to include
    const include = options.include || {
      oneTimeEntries: true,
      flexibleCategories: true,
      recurringPayments: true
    };
    return await prisma.financialProfile.findUnique({
      where: { userId },
      include
    });
  } catch (err) {
    console.error('Error in getProfileByUserId:', err);
    throw new Error('Database error');
  }
}

async function createProfile({ userId, monthlyIncomeMinor, referenceDayOfMonth, periodLabel }) {
  try {
    return await prisma.financialProfile.create({
      data: { userId, monthlyIncomeMinor, referenceDayOfMonth, periodLabel }
    });
  } catch (err) {
    console.error('Error in createProfile:', err);
    throw new Error('Database error');
  }
}

async function updateProfile(userId, data) {
  try {
    return await prisma.financialProfile.update({
      where: { userId },
      data
    });
  } catch (err) {
    console.error('Error in updateProfile:', err);
    throw new Error('Database error');
  }
}

async function seedDefaultProfile(userId) {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const now = new Date();
  const periodLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  try {
    return await prisma.financialProfile.create({
      data: {
        userId,
        monthlyIncomeMinor: 0,
        referenceDayOfMonth: 1,
        periodLabel
      },
      include: {
        flexibleCategories: true,
        recurringPayments: true,
        oneTimeEntries: true
      }
    });
  } catch (err) {
    console.error('Error in seedDefaultProfile:', err);
    throw new Error('Database error');
  }
}

async function replaceProfileForUser(userId, profileData) {
  const { toMinorUnits } = require('../utils/money');
  try {
    // Delete existing recurring payments and flexible categories
    const existing = await prisma.financialProfile.findUnique({ where: { userId } });
    if (existing) {
      await prisma.recurringPayment.deleteMany({ where: { profileId: existing.id } });
      await prisma.flexibleCategory.deleteMany({ where: { profileId: existing.id } });
      await prisma.oneTimeEntry.deleteMany({ where: { profileId: existing.id } });
    }
    // Update profile and create new records
    return await prisma.financialProfile.update({
      where: { userId },
      data: {
        monthlyIncomeMinor: profileData.monthlyIncomeMinor || toMinorUnits(profileData.monthlyIncome || 0),
        referenceDayOfMonth: profileData.referenceDayOfMonth,
        periodLabel: profileData.periodLabel,
        flexibleCategories: {
          create: (profileData.flexibleCategories || []).map(c => ({
            name: c.name,
            amountMinor: c.amountMinor || toMinorUnits(c.amount || 0),
            kind: c.kind || 'Flexible'
          }))
        },
        recurringPayments: {
          create: (profileData.recurringPayments || []).map(p => ({
            label: p.label,
            amountMinor: p.amountMinor || toMinorUnits(p.amount || 0),
            cadence: p.cadence,
            paymentType: p.paymentType,
            category: p.category,
            dueDay: p.dueDay
          }))
        }
      },
      include: {
        flexibleCategories: true,
        recurringPayments: true,
        oneTimeEntries: true
      }
    });
  } catch (err) {
    console.error('Error in replaceProfileForUser:', err);
    throw new Error('Database error');
  }
}

module.exports = {
  getProfileByUserId,
  createProfile,
  updateProfile,
  seedDefaultProfile,
  replaceProfileForUser
};
