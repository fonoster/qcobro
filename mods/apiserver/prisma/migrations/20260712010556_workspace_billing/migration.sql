-- CreateEnum
CREATE TYPE "BillingMeter" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP_MESSAGE', 'VOICE_PRERECORDED', 'VOICE_AI', 'WHATSAPP_VOICE_PRERECORDED', 'WHATSAPP_VOICE_AI');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('GRANT', 'USAGE_DEBIT', 'VOID', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL,
    "createdFromUserRef" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "collectionMethod" TEXT NOT NULL DEFAULT 'charge_automatically',
    "paymentFailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_billing" (
    "workspaceRef" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "rateOverrides" JSONB,
    "stripeSubscriptionItemId" TEXT,
    "cycleStart" TIMESTAMP(3),
    "cycleEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_billing_pkey" PRIMARY KEY ("workspaceRef")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "meter" "BillingMeter" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMicro" BIGINT NOT NULL,
    "amountMicro" BIGINT NOT NULL,
    "increments" TEXT,
    "settledAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "portfolioAccountId" TEXT,
    "providerRef" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "kind" "LedgerEntryKind" NOT NULL,
    "amountMicro" BIGINT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "usageRecordId" TEXT,
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripeCustomerId_key" ON "billing_accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripeSubscriptionId_key" ON "billing_accounts"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_billing_stripeSubscriptionItemId_key" ON "workspace_billing"("stripeSubscriptionItemId");

-- CreateIndex
CREATE INDEX "workspace_billing_billingAccountId_idx" ON "workspace_billing"("billingAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_providerRef_key" ON "usage_records"("providerRef");

-- CreateIndex
CREATE INDEX "usage_records_workspaceRef_at_idx" ON "usage_records"("workspaceRef", "at");

-- CreateIndex
CREATE INDEX "ledger_entries_workspaceRef_at_idx" ON "ledger_entries"("workspaceRef", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_workspaceRef_stripeInvoiceId_kind_key" ON "ledger_entries"("workspaceRef", "stripeInvoiceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_usageRecordId_kind_key" ON "ledger_entries"("usageRecordId", "kind");

-- AddForeignKey
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "billing_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

