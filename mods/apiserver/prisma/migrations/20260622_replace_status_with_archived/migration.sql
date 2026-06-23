-- Replace the portfolio status enum and the (planned) agent status concept with a
-- single `archivedAt` timestamp on both: NULL = active, a timestamp = archived. Lists
-- exclude archived rows by default; an "include archived" toggle reveals them.

-- Portfolios: migrate ARCHIVED rows to a timestamp (best-effort: their updatedAt),
-- then drop the status column and its enum type.
ALTER TABLE "portfolios" ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "portfolios" SET "archivedAt" = "updatedAt" WHERE "status" = 'ARCHIVED';
ALTER TABLE "portfolios" DROP COLUMN "status";
DROP TYPE "PortfolioStatus";

-- Agent templates: add the archivedAt timestamp (there was no prior status concept).
ALTER TABLE "agent_templates" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Reindex on (workspaceRef, archivedAt) so the default non-archived list stays fast.
DROP INDEX "portfolios_workspaceRef_idx";
CREATE INDEX "portfolios_workspaceRef_archivedAt_idx" ON "portfolios"("workspaceRef", "archivedAt");
DROP INDEX "agent_templates_workspaceRef_idx";
CREATE INDEX "agent_templates_workspaceRef_archivedAt_idx" ON "agent_templates"("workspaceRef", "archivedAt");
