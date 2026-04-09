/*
  Warnings:

  - Added the required column `updatedAt` to the `OneTimeEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FinancialProfile" DROP CONSTRAINT "FinancialProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "FlexibleCategory" DROP CONSTRAINT "FlexibleCategory_profileId_fkey";

-- DropForeignKey
ALTER TABLE "OneTimeEntry" DROP CONSTRAINT "OneTimeEntry_profileId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringPayment" DROP CONSTRAINT "RecurringPayment_profileId_fkey";

-- AlterTable
ALTER TABLE "OneTimeEntry" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "FinancialProfile" ADD CONSTRAINT "FinancialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeEntry" ADD CONSTRAINT "OneTimeEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlexibleCategory" ADD CONSTRAINT "FlexibleCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
