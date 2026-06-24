import { createApiKeySchema, apiKeyRefSchema } from "@qcobro/common";
import { router, adminProcedure } from "../trpc.js";
import { identityCall } from "../identityCall.js";

// Workspace-scoped API-key management. All operations require workspace
// owner/admin (adminProcedure) and act on the caller's active workspace,
// proxying to Fonoster Identity through the tRPC context. Secrets are only
// ever returned by create/regenerate — never by list.
export const apiKeysRouter = router({
  // List the active workspace's keys (no secrets).
  list: adminProcedure.query(({ ctx }) =>
    identityCall(() => ctx.identity.listApiKeys(ctx.workspace.accessKeyId, ctx.token))
  ),

  // Create a key with a role and optional expiry; the response carries the
  // secret, which the client shows exactly once.
  create: adminProcedure
    .input(createApiKeySchema)
    .mutation(({ ctx, input }) =>
      identityCall(() =>
        ctx.identity.createApiKey(
          { role: input.role, expiresAt: input.expiresAt },
          ctx.workspace.accessKeyId,
          ctx.token
        )
      )
    ),

  // Rotate a key's secret in place (same ref/role); the new secret is shown once.
  regenerate: adminProcedure
    .input(apiKeyRefSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() =>
        ctx.identity.regenerateApiKey(input.ref, ctx.workspace.accessKeyId, ctx.token)
      )
    ),

  // Permanently delete a key — this is the revocation mechanism (no soft-disable).
  delete: adminProcedure
    .input(apiKeyRefSchema)
    .mutation(({ ctx, input }) =>
      identityCall(() => ctx.identity.deleteApiKey(input.ref, ctx.workspace.accessKeyId, ctx.token))
    )
});
