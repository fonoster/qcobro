import {
  upsertWhatsAppIntegrationSchema,
  withErrorHandlingAndValidation,
  type UpsertWhatsAppIntegrationInput,
  type WhatsAppIntegrationClient,
  type WhatsAppIntegrationView
} from "@qcobro/common";

/**
 * Connect or update the active workspace's WABA. The `accessToken` is the tenant secret:
 * it is written through the cloak field-encryption extension (encrypted at rest) and is
 * NEVER returned — the function projects the upserted row to a {@link WhatsAppIntegrationView}.
 * Invalid input (missing wabaId/token/verifyToken/language) is rejected by validation
 * before any write. Upserts so re-connecting rotates the credentials in place.
 */
export function createUpsertWhatsAppIntegration(
  client: WhatsAppIntegrationClient,
  workspaceRef: string
) {
  const fn = async (input: UpsertWhatsAppIntegrationInput): Promise<WhatsAppIntegrationView> => {
    const row = await client.whatsAppIntegration.upsert({
      where: { workspaceRef },
      create: {
        workspaceRef,
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        verifyToken: input.verifyToken,
        defaultLanguage: input.defaultLanguage
      },
      update: {
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        verifyToken: input.verifyToken,
        defaultLanguage: input.defaultLanguage,
        // Credentials changed — the last reachability check (if any) ran against the old
        // token/WABA and no longer means anything. Clear it so the next `get` re-checks
        // against Meta instead of trusting a cached result for credentials that are gone.
        lastCheckedAt: null,
        lastCheckedOk: null
      }
    });
    return {
      connected: true,
      wabaId: row.wabaId,
      verifyToken: row.verifyToken,
      defaultLanguage: row.defaultLanguage
    };
  };
  return withErrorHandlingAndValidation(fn, upsertWhatsAppIntegrationSchema);
}
