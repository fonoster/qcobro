-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_portfolioId_externalId_key" ON "accounts"("portfolioId", "externalId");
