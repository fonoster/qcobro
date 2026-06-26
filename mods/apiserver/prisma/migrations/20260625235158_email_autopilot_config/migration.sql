-- AlterTable
ALTER TABLE "email_configs" ADD COLUMN     "maxReplies" INTEGER,
ADD COLUMN     "systemPrompt" TEXT NOT NULL DEFAULT '';
