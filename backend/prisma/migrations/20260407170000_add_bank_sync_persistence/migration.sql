-- CreateTable
CREATE TABLE "BankSyncProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerDisplayName" TEXT NOT NULL,
    "providerStrategy" JSONB NOT NULL,
    "consent" JSONB NOT NULL,
    "linkedAccount" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSyncProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSyncTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "categoryHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSyncTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSyncSyncSummary" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ingestionId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "acceptedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "rejectedCount" INTEGER NOT NULL,
    "acceptedTransactionIds" JSONB NOT NULL,
    "duplicateTransactionIds" JSONB NOT NULL,
    "rejectedTransactions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSyncSyncSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankSyncProfile_userId_key" ON "BankSyncProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSyncTransaction_profileId_transactionId_key" ON "BankSyncTransaction"("profileId", "transactionId");

-- AddForeignKey
ALTER TABLE "BankSyncProfile" ADD CONSTRAINT "BankSyncProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSyncTransaction" ADD CONSTRAINT "BankSyncTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BankSyncProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSyncSyncSummary" ADD CONSTRAINT "BankSyncSyncSummary_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BankSyncProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;