-- AlterTable
ALTER TABLE "account_contact_logs" ADD COLUMN     "providerRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "account_contact_logs_providerRef_key" ON "account_contact_logs"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_contactLogId_type_key" ON "objectives"("contactLogId", "type");

