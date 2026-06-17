-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountCount" INTEGER NOT NULL DEFAULT 0,
    "totalOutstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_accounts" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "preferredLanguage" TEXT,
    "bestTimeToCall" TEXT,
    "customerSegment" TEXT,
    "principalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termsFrequency" TEXT,
    "termsLength" INTEGER NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "missedInstallments" INTEGER NOT NULL DEFAULT 0,
    "lastPaymentDate" TIMESTAMP(3),
    "lastPaymentAmount" DOUBLE PRECISION,
    "negotiationOptions" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolios_workspaceRef_idx" ON "portfolios"("workspaceRef");

-- CreateIndex
CREATE INDEX "portfolio_accounts_portfolioId_archivedAt_idx" ON "portfolio_accounts"("portfolioId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_accounts_portfolioId_externalId_key" ON "portfolio_accounts"("portfolioId", "externalId");

-- AddForeignKey
ALTER TABLE "portfolio_accounts" ADD CONSTRAINT "portfolio_accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
