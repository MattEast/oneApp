// backend/scripts/seedTestDb.js
// Seeds the test database with the demo user for integration tests
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const demoEmail = 'demo@oneapp.local';
  const demoPassword = 'DemoPass123!';
  const demoFullname = 'Demo Customer';

  const hashedPassword = await bcrypt.hash(demoPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      fullname: demoFullname,
      email: demoEmail,
      password: hashedPassword,
    },
  });

  // Seed a financial profile for the demo user
  const profile = await prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      monthlyIncomeMinor: 500000,
      referenceDayOfMonth: 1,
      periodLabel: 'April 2026',
    },
  });

  // Seed generic recurring payments for dashboard tests
  await prisma.recurringPayment.createMany({
    data: [
      {
        profileId: profile.id,
        label: 'Rent',
        amountMinor: 120000,
        cadence: 'monthly',
        paymentType: 'expense',
        category: 'Housing',
        dueDay: 5
      },
      {
        profileId: profile.id,
        label: 'Energy Direct Debit',
        amountMinor: 20000,
        cadence: 'monthly',
        paymentType: 'expense',
        category: 'Utilities',
        dueDay: 2
      }
    ]
  });

  console.log('Seeded demo user, financial profile, and recurring payments for test DB.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
