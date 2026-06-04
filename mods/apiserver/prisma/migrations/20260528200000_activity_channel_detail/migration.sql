-- Extend activities with AI insights, debt amount, call duration, and channel-specific JSON
ALTER TABLE "activities" ADD COLUMN "debtAmount"      REAL    NOT NULL DEFAULT 0;
ALTER TABLE "activities" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "activities" ADD COLUMN "aiSummary"       TEXT;
ALTER TABLE "activities" ADD COLUMN "aiSentiment"     TEXT;
ALTER TABLE "activities" ADD COLUMN "aiDebtReason"    TEXT;
ALTER TABLE "activities" ADD COLUMN "aiResult"        TEXT;
ALTER TABLE "activities" ADD COLUMN "aiNextStep"      TEXT;
ALTER TABLE "activities" ADD COLUMN "channelData"     TEXT;
