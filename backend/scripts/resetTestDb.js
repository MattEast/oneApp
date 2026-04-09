// backend/scripts/resetTestDb.js
// WARNING: This will delete all data in the test database!
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete all data in the correct order for foreign key constraints
  await prisma.recurringPayment.deleteMany();
  await prisma.oneTimeEntry.deleteMany();
  await prisma.flexibleCategory.deleteMany();
  await prisma.financialProfile.deleteMany();
  await prisma.user.deleteMany();
  console.log('Test database reset: all user and related data deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
