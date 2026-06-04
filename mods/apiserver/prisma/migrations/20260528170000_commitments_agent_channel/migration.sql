-- Add channel to agents
ALTER TABLE "agents" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'VOICE';

-- Add agentId and channel to campaigns
ALTER TABLE "campaigns" ADD COLUMN "agentId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'VOICE';

-- Create commitments table (replaces promises)
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT_PROMISE',
    "amount" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "commitments_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing promise data into commitments
INSERT INTO "commitments" ("id", "activityId", "accountId", "type", "amount", "dueDate", "status", "createdAt", "updatedAt")
SELECT "id", "activityId", "accountId", 'PAYMENT_PROMISE', "amount", "dueDate", "status", "createdAt", "updatedAt"
FROM "promises";

-- Drop old promises table
DROP TABLE "promises";

-- Rename activities.promises relation column (activities table references promises via activities.promises[])
-- This is handled by the ORM; no SQL change needed for the FK side
