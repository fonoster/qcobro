/*
  Warnings:

  - You are about to drop the column `amount` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `accounts` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "preferredLanguage" TEXT,
    "bestTimeToCall" TEXT,
    "customerSegment" TEXT,
    "principalAmount" REAL NOT NULL DEFAULT 0,
    "termsAmount" REAL NOT NULL DEFAULT 0,
    "termsFrequency" TEXT,
    "termsLength" INTEGER NOT NULL DEFAULT 0,
    "outstandingBalance" REAL NOT NULL DEFAULT 0,
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "missedInstallments" INTEGER NOT NULL DEFAULT 0,
    "lastPaymentDate" DATETIME,
    "lastPaymentAmount" REAL,
    "negotiationOptions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_accounts" ("createdAt", "email", "externalId", "id", "phone", "portfolioId", "status", "updatedAt") SELECT "createdAt", "email", "externalId", "id", "phone", "portfolioId", "status", "updatedAt" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE UNIQUE INDEX "accounts_portfolioId_externalId_key" ON "accounts"("portfolioId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
