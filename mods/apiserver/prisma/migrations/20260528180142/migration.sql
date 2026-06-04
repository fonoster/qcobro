-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "agentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'VOICE',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "accounts" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("accounts", "agentId", "channel", "createdAt", "endDate", "id", "name", "portfolioId", "startDate", "status", "updatedAt") SELECT "accounts", "agentId", "channel", "createdAt", "endDate", "id", "name", "portfolioId", "startDate", "status", "updatedAt" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
