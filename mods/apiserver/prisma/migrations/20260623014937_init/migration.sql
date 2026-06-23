-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'DOP');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('SMS', 'VOICE_PRERECORDED', 'VOICE_AI', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PAUSED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MAX_ATTEMPTS_PER_DAY', 'DNC_CHECK', 'WRONG_NUMBER', 'OPT_OUT', 'PAYMENT_PROMISE', 'INTENT_MET', 'CALLBACK_REQUESTED');

-- CreateEnum
CREATE TYPE "ContactOutcome" AS ENUM ('NO_ANSWER', 'PAYMENT_PROMISE', 'PARTIAL_PAYMENT_AGREED', 'CALLBACK_REQUESTED', 'RESOLVED', 'PAID', 'WRONG_NUMBER', 'OPT_OUT', 'REFUSED', 'OTHER');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('INTENT_MET', 'WRONG_NUMBER', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "ObjectiveType" AS ENUM ('PAYMENT_PROMISE', 'PARTIAL_PAYMENT', 'CALLBACK_SCHEDULED', 'INFORMATION_REQUEST', 'DISPUTE_RAISED', 'OTHER');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('PENDING', 'MET', 'BROKEN', 'CANCELLED');

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountCount" INTEGER NOT NULL DEFAULT 0,
    "totalOutstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_accounts" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "preferredLanguage" TEXT,
    "bestTimeToCall" TEXT,
    "customerSegment" TEXT,
    "principalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "termsFrequency" TEXT,
    "termsLength" INTEGER NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "missedInstallments" INTEGER NOT NULL DEFAULT 0,
    "lastPaymentDate" TIMESTAMP(3),
    "lastPaymentAmount" DOUBLE PRECISION,
    "negotiationOptions" TEXT,
    "archivedAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "suppressUntil" TIMESTAMP(3),
    "intentStatus" "IntentStatus",
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_templates" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_ai_configs" (
    "templateId" TEXT NOT NULL,
    "fonosterAppName" TEXT NOT NULL,
    "fonosterAppRef" TEXT,
    "voice" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "firstMessage" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "voice_ai_configs_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "voice_prerecorded_configs" (
    "templateId" TEXT NOT NULL,
    "fonosterAppName" TEXT NOT NULL,
    "fonosterAppRef" TEXT,
    "voice" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "voice_prerecorded_configs_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "sms_configs" (
    "templateId" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "senderId" TEXT,

    CONSTRAINT "sms_configs_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "email_configs" (
    "templateId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,

    CONSTRAINT "email_configs_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "whatsapp_configs" (
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,

    CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("templateId")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "workspaceRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentTemplateId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "maxAttemptsPerAccount" INTEGER NOT NULL,
    "maxAttemptsPerDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_portfolios" (
    "campaignId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,

    CONSTRAINT "campaign_portfolios_pkey" PRIMARY KEY ("campaignId","portfolioId")
);

-- CreateTable
CREATE TABLE "campaign_triggers" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "TriggerType" NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "campaign_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_account_states" (
    "campaignId" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "attemptsToday" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "suppressUntil" TIMESTAMP(3),

    CONSTRAINT "campaign_account_states_pkey" PRIMARY KEY ("campaignId","portfolioAccountId")
);

-- CreateTable
CREATE TABLE "account_contact_logs" (
    "id" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "agentType" "AgentType" NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER,
    "outcome" "ContactOutcome" NOT NULL,
    "notes" TEXT,
    "debtAmountSnapshot" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "aiSentiment" TEXT,
    "aiDebtReason" TEXT,
    "aiResult" TEXT,
    "aiNextStep" TEXT,
    "intentMetadata" JSONB,
    "channelData" JSONB,
    "correctedEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "contactLogId" TEXT NOT NULL,
    "portfolioAccountId" TEXT NOT NULL,
    "type" "ObjectiveType" NOT NULL,
    "amount" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolios_workspaceRef_archivedAt_idx" ON "portfolios"("workspaceRef", "archivedAt");

-- CreateIndex
CREATE INDEX "portfolio_accounts_portfolioId_archivedAt_idx" ON "portfolio_accounts"("portfolioId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_accounts_portfolioId_externalId_key" ON "portfolio_accounts"("portfolioId", "externalId");

-- CreateIndex
CREATE INDEX "agent_templates_workspaceRef_archivedAt_idx" ON "agent_templates"("workspaceRef", "archivedAt");

-- CreateIndex
CREATE INDEX "campaigns_workspaceRef_idx" ON "campaigns"("workspaceRef");

-- CreateIndex
CREATE INDEX "campaign_portfolios_portfolioId_idx" ON "campaign_portfolios"("portfolioId");

-- CreateIndex
CREATE INDEX "campaign_triggers_campaignId_idx" ON "campaign_triggers"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_account_states_portfolioAccountId_idx" ON "campaign_account_states"("portfolioAccountId");

-- CreateIndex
CREATE INDEX "account_contact_logs_portfolioAccountId_createdAt_idx" ON "account_contact_logs"("portfolioAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "objectives_portfolioAccountId_dueDate_idx" ON "objectives"("portfolioAccountId", "dueDate");

-- AddForeignKey
ALTER TABLE "portfolio_accounts" ADD CONSTRAINT "portfolio_accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_ai_configs" ADD CONSTRAINT "voice_ai_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_prerecorded_configs" ADD CONSTRAINT "voice_prerecorded_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_configs" ADD CONSTRAINT "sms_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_configs" ADD CONSTRAINT "email_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agentTemplateId_fkey" FOREIGN KEY ("agentTemplateId") REFERENCES "agent_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_portfolios" ADD CONSTRAINT "campaign_portfolios_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_portfolios" ADD CONSTRAINT "campaign_portfolios_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_account_states" ADD CONSTRAINT "campaign_account_states_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_account_states" ADD CONSTRAINT "campaign_account_states_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contact_logs" ADD CONSTRAINT "account_contact_logs_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contact_logs" ADD CONSTRAINT "account_contact_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_contactLogId_fkey" FOREIGN KEY ("contactLogId") REFERENCES "account_contact_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_portfolioAccountId_fkey" FOREIGN KEY ("portfolioAccountId") REFERENCES "portfolio_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
