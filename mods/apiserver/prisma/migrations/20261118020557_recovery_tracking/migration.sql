-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('CURED', 'PAID_OFF', 'WRITTEN_OFF', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecoveryKind" AS ENUM ('PARTIAL', 'CURED', 'PAID_OFF');

-- AlterTable
ALTER TABLE "payment_promises" ADD COLUMN     "expiredByExitId" TEXT;

-- AlterTable
ALTER TABLE "portfolio_accounts" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- Backfill: active accounts start their first snapshot range at their portfolio's last sync.
-- Archived accounts stay NULL (history starts at zero; nothing is reconstructed for them).
UPDATE "portfolio_accounts" a
SET "lastSyncedAt" = p."lastSyncedAt"
FROM "portfolios" p
WHERE a."portfolioId" = p."id" AND a."archivedAt" IS NULL;

-- CreateTable
CREATE TABLE "account_exits" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "reason" "ExitReason" NOT NULL,
    "exitedAt" TIMESTAMP(3) NOT NULL,
    "previousSyncAt" TIMESTAMP(3) NOT NULL,
    "missedInstallments" INTEGER NOT NULL,
    "termsAmount" DOUBLE PRECISION NOT NULL,
    "context" JSONB NOT NULL,
    "classifiedAt" TIMESTAMP(3),
    "reenteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_exits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recoveries" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "exitId" TEXT,
    "kind" "RecoveryKind" NOT NULL,
    "installments" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "previousSyncAt" TIMESTAMP(3) NOT NULL,
    "hasGestion" BOOLEAN NOT NULL,
    "lastTouchAgentType" "AgentType",
    "lastTouchOutcome" "Outcome",
    "daysSinceLastTouch" INTEGER,
    "campaignIds" TEXT[],
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_exits_portfolioId_reason_reenteredAt_idx" ON "account_exits"("portfolioId", "reason", "reenteredAt");

-- CreateIndex
CREATE INDEX "account_exits_portfolioAccountId_exitedAt_idx" ON "account_exits"("portfolioAccountId", "exitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recoveries_exitId_key" ON "recoveries"("exitId");

-- CreateIndex
CREATE INDEX "recoveries_portfolioId_detectedAt_idx" ON "recoveries"("portfolioId", "detectedAt");

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_expiredByExitId_fkey" FOREIGN KEY ("expiredByExitId") REFERENCES "account_exits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_exits" ADD CONSTRAINT "account_exits_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoveries" ADD CONSTRAINT "recoveries_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoveries" ADD CONSTRAINT "recoveries_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recoveries" ADD CONSTRAINT "recoveries_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "account_exits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
