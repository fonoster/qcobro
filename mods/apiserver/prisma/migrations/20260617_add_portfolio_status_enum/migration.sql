-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- Migrate existing string values; CLOSED (legacy) maps to ARCHIVED
UPDATE "portfolios" SET "status" = 'ARCHIVED' WHERE "status" = 'CLOSED';

-- Drop the existing TEXT default so the column type can be cast (Postgres
-- cannot auto-cast the 'ACTIVE' text default to the new enum type).
ALTER TABLE "portfolios" ALTER COLUMN "status" DROP DEFAULT;

-- AlterColumn: cast TEXT → PortfolioStatus
ALTER TABLE "portfolios"
  ALTER COLUMN "status" TYPE "PortfolioStatus"
  USING "status"::"PortfolioStatus";

-- Set the column default using the enum type
ALTER TABLE "portfolios"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"PortfolioStatus";
