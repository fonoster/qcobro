import {
  addWhatsAppSenderNumberSchema,
  withErrorHandlingAndValidation,
  type AddWhatsAppSenderNumberInput,
  type WhatsAppIntegrationClient,
  type WhatsAppSenderNumberRecord
} from "@qcobro/common";

/**
 * Add a sender number to the active workspace's integration. `phoneNumberId` is globally
 * unique (it is the Meta per-number messaging endpoint), so a duplicate is rejected before
 * the write rather than surfacing a raw Prisma constraint error. New numbers start with the
 * `messaging` capability on and `calling` off (WhatsApp Voice is future) and an unknown
 * quality rating until Meta's first quality callback.
 */
export function createAddWhatsAppSenderNumber(
  client: WhatsAppIntegrationClient,
  workspaceRef: string
) {
  const fn = async (input: AddWhatsAppSenderNumberInput): Promise<WhatsAppSenderNumberRecord> => {
    const existing = await client.whatsAppSenderNumber.findUnique({
      where: { phoneNumberId: input.phoneNumberId }
    });
    if (existing) {
      throw new Error(`A sender number with phoneNumberId ${input.phoneNumberId} already exists`);
    }
    return client.whatsAppSenderNumber.create({
      data: {
        workspaceRef,
        phoneNumberId: input.phoneNumberId,
        displayNumber: input.displayNumber,
        label: input.label,
        qualityRating: null,
        capabilities: { messaging: true, calling: false }
      }
    });
  };
  return withErrorHandlingAndValidation(fn, addWhatsAppSenderNumberSchema);
}
