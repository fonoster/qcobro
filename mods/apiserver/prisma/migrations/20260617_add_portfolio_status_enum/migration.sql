-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- Migrate existing string values; CLOSED (legacy) maps to ARCHIVED
UPDATE "portfolios" SET "status" = 'ARCHIVED' WHERE "status" = 'CLOSED';

-- AlterColumn: cast TEXT → PortfolioStatus
ALTER TABLE "portfolios"
  ALTER COLUMN "status" TYPE "PortfolioStatus"
  USING "status"::"PortfolioStatus";

-- Set the column default using the enum type
ALTER TABLE "portfolios"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"PortfolioStatus";
