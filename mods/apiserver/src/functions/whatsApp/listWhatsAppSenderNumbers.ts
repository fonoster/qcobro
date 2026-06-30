import type { WhatsAppIntegrationClient, WhatsAppSenderNumberRecord } from "@qcobro/common";

/**
 * List the active workspace's WhatsApp sender numbers (for the integration area and the
 * campaign sender selector). Sender numbers carry no secret, so records are returned as-is.
 */
export function createListWhatsAppSenderNumbers(client: WhatsAppIntegrationClient) {
  return (workspaceRef: string): Promise<WhatsAppSenderNumberRecord[]> =>
    client.whatsAppSenderNumber.findMany({ where: { workspaceRef } });
}
