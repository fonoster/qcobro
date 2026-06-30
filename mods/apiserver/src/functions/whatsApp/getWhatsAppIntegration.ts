import type { WhatsAppIntegrationClient, WhatsAppIntegrationView } from "@qcobro/common";

/**
 * Read the active workspace's WhatsApp integration, projected to a client-safe
 * {@link WhatsAppIntegrationView}. The encrypted `accessToken` is NEVER included —
 * the view exposes only whether the WABA is connected plus the non-secret fields the
 * console needs. A workspace with no integration row returns `connected: false`.
 */
export function createGetWhatsAppIntegration(client: WhatsAppIntegrationClient) {
  return async (workspaceRef: string): Promise<WhatsAppIntegrationView> => {
    const row = await client.whatsAppIntegration.findUnique({ where: { workspaceRef } });
    if (!row) {
      return { connected: false, wabaId: "", verifyToken: "", defaultLanguage: "" };
    }
    return {
      connected: true,
      wabaId: row.wabaId,
      verifyToken: row.verifyToken,
      defaultLanguage: row.defaultLanguage
    };
  };
}
