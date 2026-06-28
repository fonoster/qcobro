-- CreateEnum
CREATE TYPE "PaymentPromiseStatus" AS ENUM ('PENDING', 'MET', 'EXPIRED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactOutcome" ADD VALUE 'DELIVERED';
ALTER TYPE "ContactOutcome" ADD VALUE 'NOT_DELIVERED';
ALTER TYPE "ContactOutcome" ADD VALUE 'NEW_TERMS';
ALTER TYPE "ContactOutcome" ADD VALUE 'DISPUTE_RAISED';
ALTER TYPE "ContactOutcome" ADD VALUE 'INFORMATION_REQUEST';

-- DropForeignKey
ALTER TABLE "objectives" DROP CONSTRAINT "objectives_contactLogId_fkey";

-- DropForeignKey
ALTER TABLE "objectives" DROP CONSTRAINT "objectives_portfolioAccountId_fkey";

-- AlterTable
ALTER TABLE "account_contact_logs" ADD COLUMN     "agentTemplateId" TEXT,
ADD COLUMN     "paymentPromiseId" TEXT;

-- DropTable
DROP TABLE "objectives";

-- DropEnum
DROP TYPE "ObjectiveStatus";

-- DropEnum
DROP TYPE "ObjectiveType";

-- CreateTable
CREATE TABLE "payment_promises" (
    "id" TEXT NOT NULL,
    "contactLogId" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentPromiseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_promises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_promises_portfolioAccountId_dueDate_idx" ON "payment_promises"("portfolioAccountId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "payment_promises_contactLogId_key" ON "payment_promises"("contactLogId");

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_contactLogId_fkey" FOREIGN KEY ("contactLogId") REFERENCES "account_contact_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

