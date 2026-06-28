import type { AgentType } from "../schemas/agentTemplates.js";
import type {
  CampaignStatus,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignStatusInput,
  DeleteCampaignInput
} from "../schemas/campaigns.js";
import type {
  ContactOutcome,
  PaymentPromiseStatus,
  CreateContactLogInput,
  UpdatePaymentPromiseInput,
  FollowUpPaymentPromiseInput
} from "../schemas/contactLog.js";

export interface CampaignRecord {
  id: string;
  workspaceRef: string;
  name: string;
  agentTemplateId: string;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignTriggerRecord {
  id: string;
  campaignId: string;
  type:
    | "MAX_ATTEMPTS_PER_DAY"
    | "DNC_CHECK"
    | "WRONG_NUMBER"
    | "OPT_OUT"
    | "PAYMENT_PROMISE"
    | "INTENT_MET"
    | "CALLBACK_REQUESTED";
  config: Record<string, unknown>;
}

export interface CampaignAccountStateRecord {
  campaignId: string;
  portfolioAccountId: string;
  attemptCount: number;
  attemptsToday: number;
  lastAttemptAt: Date | null;
  suppressUntil: Date | null;
}

export interface AccountContactLogRecord {
  id: string;
  portfolioAccountId: string;
  campaignId: string | null;
  agentType: AgentType;
  contactedAt: Date;
  durationSeconds: number | null;
  outcome: ContactOutcome;
  notes: string | null;
  debtAmountSnapshot: number | null;
  aiSummary: string | null;
  aiSentiment: string | null;
  aiDebtReason: string | null;
  aiResult: string | null;
  aiNextStep: string | null;
  intentMetadata: Record<string, unknown> | null;
  channelData: Record<string, unknown> | null;
  correctedEntryId: string | null;
  agentTemplateId: string | null;
  paymentPromiseId: string | null;
  providerRef: string | null;
  createdAt: Date;
}

export interface PaymentPromiseRecord {
  id: string;
  contactLogId: string;
  portfolioAccountId: string;
  amount: number | null;
  dueDate: Date;
  status: PaymentPromiseStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignClient {
  agentTemplate: {
    findFirst(args: {
      where: { id: string; workspaceRef: string };
    }): Promise<{ id: string; workspaceRef: string; type: AgentType } | null>;
  };

  campaign: {
    findMany(args: {
      where: { workspaceRef: string; status?: CampaignStatus | { notIn: CampaignStatus[] } };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<CampaignRecord[]>;

    findFirst(args: {
      where: { id: string; workspaceRef?: string };
    }): Promise<CampaignRecord | null>;

    findFirstOrThrow(args: {
      where: { id: string; workspaceRef: string };
    }): Promise<CampaignRecord>;

    create(args: { data: Record<string, unknown> }): Promise<CampaignRecord>;

    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<CampaignRecord>;

    delete(args: { where: { id: string } }): Promise<CampaignRecord>;
  };

  campaignPortfolio: {
    createMany(args: {
      data: Array<{ campaignId: string; portfolioId: string }>;
    }): Promise<{ count: number }>;
  };

  campaignTrigger: {
    findMany(args: { where: { campaignId: string } }): Promise<CampaignTriggerRecord[]>;
  };

  campaignAccountState: {
    findUnique(args: {
      where: {
        campaignId_portfolioAccountId: { campaignId: string; portfolioAccountId: string };
      };
    }): Promise<CampaignAccountStateRecord | null>;

    upsert(args: {
      where: {
        campaignId_portfolioAccountId: { campaignId: string; portfolioAccountId: string };
      };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<CampaignAccountStateRecord>;

    count(args: { where: { campaignId: string; attemptCount?: { gt: number } } }): Promise<number>;
  };

  accountContactLog: {
    create(args: { data: Record<string, unknown> }): Promise<AccountContactLogRecord>;
    findFirst(args: { where: Record<string, unknown> }): Promise<AccountContactLogRecord | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<AccountContactLogRecord>;
    findMany(args: {
      where: Record<string, unknown>;
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
      skip?: number;
    }): Promise<AccountContactLogRecord[]>;
  };

  paymentPromise: {
    create(args: { data: Record<string, unknown> }): Promise<PaymentPromiseRecord>;
    findFirst(args: { where: Record<string, unknown> }): Promise<PaymentPromiseRecord | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PaymentPromiseRecord>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: { status: PaymentPromiseStatus };
    }): Promise<{ count: number }>;
    findMany(args: {
      where: Record<string, unknown>;
      orderBy?: { dueDate: "asc" | "desc" };
    }): Promise<PaymentPromiseRecord[]>;
  };

  portfolioAccount: {
    findFirst(args: {
      where: { id: string };
    }): Promise<{ id: string; portfolioId: string; outstandingBalance: number } | null>;

    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
  };

  portfolio: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
  };

  $transaction<T>(fn: (tx: CampaignClient) => Promise<T>): Promise<T>;
}

export type {
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignStatusInput,
  DeleteCampaignInput,
  CreateContactLogInput,
  UpdatePaymentPromiseInput,
  FollowUpPaymentPromiseInput
};
