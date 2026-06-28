-- AlterTable
ALTER TABLE "portfolios" DROP COLUMN "currency";

-- CreateTable
CREATE TABLE "workspace_settings" (
    "workspaceRef" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspaceRef")
);

