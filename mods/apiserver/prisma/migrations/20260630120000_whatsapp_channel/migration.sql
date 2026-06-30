-- AlterTable
ALTER TABLE "whatsapp_configs" ADD COLUMN     "maxReplies" INTEGER,
ADD COLUMN     "metaTemplateId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "systemPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "whatsAppSenderNumberId" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_integrations" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sender_numbers" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "qualityRating" TEXT,
    "capabilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sender_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_integrations_workspaceRef_key" ON "whatsapp_integrations"("workspaceRef");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sender_numbers_phoneNumberId_key" ON "whatsapp_sender_numbers"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_sender_numbers_workspaceRef_idx" ON "whatsapp_sender_numbers"("workspaceRef");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_whatsAppSenderNumberId_fkey" FOREIGN KEY ("whatsAppSenderNumberId") REFERENCES "whatsapp_sender_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sender_numbers" ADD CONSTRAINT "whatsapp_sender_numbers_workspaceRef_fkey" FOREIGN KEY ("workspaceRef") REFERENCES "whatsapp_integrations"("workspaceRef") ON DELETE CASCADE ON UPDATE CASCADE;

