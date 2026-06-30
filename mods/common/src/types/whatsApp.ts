import type { WhatsAppCapabilities } from "../schemas/whatsApp.js";

/**
 * DB record + client surfaces for the per-workspace WhatsApp integration. The
 * `accessToken` is encrypted at rest (cloak) and MUST NOT be returned to clients —
 * read procedures project to {@link WhatsAppIntegrationView}.
 */
export interface WhatsAppIntegrationRecord {
  id: string;
  workspaceRef: string;
  wabaId: string;
  /** Tenant secret — encrypted at rest; never serialized to the client. */
  accessToken: string;
  verifyToken: string;
  /** Meta template-send language for this workspace (e.g. `es_DO`). */
  defaultLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-safe projection of the integration (no secret). */
export interface WhatsAppIntegrationView {
  connected: boolean;
  wabaId: string;
  verifyToken: string;
  defaultLanguage: string;
}

export interface WhatsAppSenderNumberRecord {
  id: string;
  workspaceRef: string;
  phoneNumberId: string;
  displayNumber: string;
  label: string;
  /** Cached from Meta quality callbacks: GREEN | YELLOW | RED | null (unknown). */
  qualityRating: string | null;
  capabilities: WhatsAppCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

/** The DB surface the WhatsApp integration functions need (tests inject a stub). */
export interface WhatsAppIntegrationClient {
  whatsAppIntegration: {
    findUnique(args: {
      where: { workspaceRef: string };
    }): Promise<WhatsAppIntegrationRecord | null>;
    upsert(args: {
      where: { workspaceRef: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<WhatsAppIntegrationRecord>;
  };
  whatsAppSenderNumber: {
    findUnique(args: {
      where: { phoneNumberId: string };
    }): Promise<WhatsAppSenderNumberRecord | null>;
    findMany(args: { where: { workspaceRef: string } }): Promise<WhatsAppSenderNumberRecord[]>;
    create(args: { data: Record<string, unknown> }): Promise<WhatsAppSenderNumberRecord>;
    delete(args: { where: { phoneNumberId: string } }): Promise<WhatsAppSenderNumberRecord>;
  };
}
