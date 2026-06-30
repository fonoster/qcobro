import type { WhatsAppClient, WhatsAppIntegrationClient } from "@qcobro/common";
import { MetaWhatsAppClient } from "./metaWhatsAppClient.js";

/** Graph API connection defaults (from `config.whatsapp`). */
export interface WhatsAppApiSettings {
  apiBaseUrl: string;
  apiVersion: string;
}

/**
 * Resolve a {@link WhatsAppClient} for one dispatch from the owning workspace's stored
 * integration. Credentials are tenant-owned, so the client cannot be injected once at boot
 * like the voice/SMS pools — it is built per-call here. The cloak extension transparently
 * decrypts `accessToken` on read; it is used only to construct the client and never returned.
 *
 * Returns `null` when the workspace has no integration (the caller treats this as
 * "WhatsApp not configured"). `phoneNumberId` is the selected sender for sends; it may be
 * omitted for template-preview reads, which address the WABA, not a specific number.
 */
export async function resolveWhatsAppClient(
  db: WhatsAppIntegrationClient,
  workspaceRef: string,
  api: WhatsAppApiSettings,
  phoneNumberId?: string
): Promise<WhatsAppClient | null> {
  const integration = await db.whatsAppIntegration.findUnique({ where: { workspaceRef } });
  if (!integration) return null;
  return new MetaWhatsAppClient({
    phoneNumberId: phoneNumberId ?? "",
    accessToken: integration.accessToken,
    wabaId: integration.wabaId,
    apiBaseUrl: api.apiBaseUrl,
    apiVersion: api.apiVersion
  });
}
