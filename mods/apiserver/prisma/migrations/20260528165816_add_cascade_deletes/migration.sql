-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "agentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'CALL',
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "activities_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_activities" ("accountId", "agentId", "campaignId", "channel", "createdAt", "id", "notes", "outcome", "updatedAt") SELECT "accountId", "agentId", "campaignId", "channel", "createdAt", "id", "notes", "outcome", "updatedAt" FROM "activities";
DROP TABLE "activities";
ALTER TABLE "new_activities" RENAME TO "activities";
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "accounts" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("accounts", "createdAt", "endDate", "id", "name", "portfolioId", "startDate", "status", "updatedAt") SELECT "accounts", "createdAt", "endDate", "id", "name", "portfolioId", "startDate", "status", "updatedAt" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
CREATE TABLE "new_promises" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "promises_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_promises" ("accountId", "activityId", "amount", "createdAt", "dueDate", "id", "status", "updatedAt") SELECT "accountId", "activityId", "amount", "createdAt", "dueDate", "id", "status", "updatedAt" FROM "promises";
DROP TABLE "promises";
ALTER TABLE "new_promises" RENAME TO "promises";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
