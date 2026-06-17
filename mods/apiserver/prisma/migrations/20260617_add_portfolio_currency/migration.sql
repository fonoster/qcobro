-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'DOP');

-- AlterTable: add currency column (existing rows default to USD)
ALTER TABLE "portfolios" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'USD';
