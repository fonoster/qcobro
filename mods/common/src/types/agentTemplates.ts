import type {
  AgentType,
  CollectionStrategy,
  CreateAgentTemplateInput,
  UpdateAgentTemplateInput,
  DeleteAgentTemplateInput
} from "../schemas/agentTemplates.js";

export interface AgentTemplateRecord {
  id: string;
  workspaceRef: string;
  name: string;
  type: AgentType;
  collectionStrategy: CollectionStrategy;
  totalCalls: number;
  totalPromises: number;
  totalRecovered: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceAiConfigRecord {
  templateId: string;
  fonosterAppName: string;
  fonosterAppRef: string | null;
  voice: string;
  systemPrompt: string;
  firstMessage: string;
  language: string;
}

export interface VoicePrerecordedConfigRecord {
  templateId: string;
  fonosterAppName: string;
  fonosterAppRef: string | null;
  voice: string;
  script: string;
  firstMessage: string;
  language: string;
}

export interface SmsConfigRecord {
  templateId: string;
  messageBody: string;
  senderId: string | null;
}

export interface EmailConfigRecord {
  templateId: string;
  subject: string;
  messageBody: string;
  fromName: string;
  fromEmail: string;
}

export interface WhatsAppConfigRecord {
  templateId: string;
  templateName: string;
  messageBody: string;
}

/** A child-config delegate exposing the create/update calls the functions use. */
interface ChildConfigDelegate<R> {
  create(args: { data: Record<string, unknown> }): Promise<R>;
  update(args: { where: { templateId: string }; data: Record<string, unknown> }): Promise<R>;
}

export interface AgentTemplateClient {
  agentTemplate: {
    findMany(args: {
      where: { workspaceRef: string; type?: AgentType };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<AgentTemplateRecord[]>;

    findFirst(args: {
      where: { id: string; workspaceRef: string };
    }): Promise<AgentTemplateRecord | null>;

    findFirstOrThrow(args: {
      where: { id: string; workspaceRef: string };
    }): Promise<AgentTemplateRecord>;

    create(args: { data: Record<string, unknown> }): Promise<AgentTemplateRecord>;

    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<AgentTemplateRecord>;

    delete(args: { where: { id: string } }): Promise<AgentTemplateRecord>;
  };

  voiceAiConfig: ChildConfigDelegate<VoiceAiConfigRecord>;
  voicePrerecordedConfig: ChildConfigDelegate<VoicePrerecordedConfigRecord>;
  smsConfig: ChildConfigDelegate<SmsConfigRecord>;
  emailConfig: ChildConfigDelegate<EmailConfigRecord>;
  whatsAppConfig: ChildConfigDelegate<WhatsAppConfigRecord>;

  campaign: {
    count(args: {
      where: { agentTemplateId: string; status?: { not: "ARCHIVED" } };
    }): Promise<number>;
  };

  $transaction<T>(fn: (tx: AgentTemplateClient) => Promise<T>): Promise<T>;
}

export type { CreateAgentTemplateInput, UpdateAgentTemplateInput, DeleteAgentTemplateInput };
