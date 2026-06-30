import {
  removeWhatsAppSenderNumberSchema,
  withErrorHandlingAndValidation,
  type RemoveWhatsAppSenderNumberInput,
  type WhatsAppIntegrationClient,
  type WhatsAppSenderNumberRecord
} from "@qcobro/common";

/**
 * Remove a sender number from the active workspace's integration. Ownership is checked
 * first — a workspace can only remove its own numbers, even though `phoneNumberId` is
 * globally unique — and an unknown id is rejected before the delete.
 */
export function createRemoveWhatsAppSenderNumber(
  client: WhatsAppIntegrationClient,
  workspaceRef: string
) {
  const fn = async (
    input: RemoveWhatsAppSenderNumberInput
  ): Promise<WhatsAppSenderNumberRecord> => {
    const existing = await client.whatsAppSenderNumber.findUnique({
      where: { phoneNumberId: input.phoneNumberId }
    });
    if (!existing || existing.workspaceRef !== workspaceRef) {
      throw new Error(
        `No sender number with phoneNumberId ${input.phoneNumberId} in this workspace`
      );
    }
    return client.whatsAppSenderNumber.delete({
      where: { phoneNumberId: input.phoneNumberId }
    });
  };
  return withErrorHandlingAndValidation(fn, removeWhatsAppSenderNumberSchema);
}
