-- CreateEnum
CREATE TYPE "CampaignPauseReason" AS ENUM ('MANUAL', 'AUTO_ERROR_THRESHOLD');

-- AlterEnum
ALTER TYPE "EngineEventKind" ADD VALUE 'CAMPAIGN_AUTOPAUSED';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "pauseReason" "CampaignPauseReason";
