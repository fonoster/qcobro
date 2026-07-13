-- AlterTable
ALTER TABLE "whatsapp_integrations" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastCheckedOk" BOOLEAN;
