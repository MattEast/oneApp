-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyIncomeMinor" INTEGER NOT NULL,
    "referenceDayOfMonth" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,

    CONSTRAINT "FinancialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OneTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlexibleCategory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "FlexibleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringPayment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "cadence" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueDay" INTEGER NOT NULL,

    CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProfile_userId_key" ON "FinancialProfile"("userId");

-- AddForeignKey
ALTER TABLE "FinancialProfile" ADD CONSTRAINT "FinancialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeEntry" ADD CONSTRAINT "OneTimeEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlexibleCategory" ADD CONSTRAINT "FlexibleCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
