-- AlterTable
ALTER TABLE "BankSyncProfile" ADD COLUMN     "syncCheckpoint" JSONB;

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "syncCheckpoint" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncJob_profileId_status_idx" ON "SyncJob"("profileId", "status");

-- CreateIndex
CREATE INDEX "SyncJob_status_scheduledAt_idx" ON "SyncJob"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BankSyncProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
