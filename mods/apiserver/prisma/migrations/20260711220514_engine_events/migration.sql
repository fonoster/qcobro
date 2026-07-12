-- CreateEnum
CREATE TYPE "EngineEventKind" AS ENUM ('TICK_STARTED', 'TICK_COMPLETED', 'CAMPAIGN_EVALUATED', 'ACCOUNT_DECIDED', 'ATTEMPT_RESERVED', 'DISPATCH_REQUESTED', 'DISPATCH_SUCCEEDED', 'DISPATCH_FAILED', 'PROVIDER_EVENT');

-- CreateTable
CREATE TABLE "engine_events" (
    "id" TEXT NOT NULL,
    "tickId" TEXT,
    "seq" INTEGER,
    "kind" "EngineEventKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "workspaceRef" TEXT,
    "campaignId" TEXT,
    "portfolioAccountId" TEXT,
    "providerRef" TEXT,
    "channel" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engine_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engine_events_tickId_idx" ON "engine_events"("tickId");

-- CreateIndex
CREATE INDEX "engine_events_campaignId_at_idx" ON "engine_events"("campaignId", "at");

-- CreateIndex
CREATE INDEX "engine_events_providerRef_idx" ON "engine_events"("providerRef");

-- CreateIndex
CREATE INDEX "engine_events_at_idx" ON "engine_events"("at");
