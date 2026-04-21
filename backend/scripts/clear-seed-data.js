#!/usr/bin/env node
// One-time migration: clear hardcoded seed data from existing profiles

const prisma = require('../db/prisma');

async function migrateSeedData() {
  const seededProfiles = await prisma.financialProfile.findMany({
    where: { monthlyIncomeMinor: 425000 },
    include: { recurringPayments: true, flexibleCategories: true }
  });

  console.log('Found', seededProfiles.length, 'profile(s) with seed data');

  for (const profile of seededProfiles) {
    const labels = profile.recurringPayments.map(p => p.label).sort();
    const isSeedData = labels.includes('Rent') && labels.includes('Council tax') && labels.includes('Broadband');

    if (!isSeedData) {
      console.log('  Skipping profile', profile.id, '— looks like user-entered data');
      continue;
    }

    await prisma.$transaction([
      prisma.recurringPayment.deleteMany({ where: { profileId: profile.id } }),
      prisma.flexibleCategory.deleteMany({ where: { profileId: profile.id } }),
      prisma.financialProfile.update({
        where: { id: profile.id },
        data: { monthlyIncomeMinor: 0 }
      })
    ]);

    console.log('  Cleared seed data for profile', profile.id);
  }

  await prisma.$disconnect();
  console.log('Done.');
}

migrateSeedData().catch(e => { console.error(e); process.exit(1); });
