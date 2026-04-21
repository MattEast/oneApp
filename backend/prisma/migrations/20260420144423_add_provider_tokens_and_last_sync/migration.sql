-- AlterTable
ALTER TABLE "BankSyncProfile" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "providerTokens" JSONB;
