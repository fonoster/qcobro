import { z } from "zod";

/**
 * Local schemas for portfolio operations whose inputs the apiserver defines
 * inline (rather than in `@qcobro/common`). Kept minimal and matched to the
 * server's inline `z.object(...)` shapes so the SDK can validate client-side
 * before a request is sent. Contract-bearing inputs (create/update/delete/
 * syncAccounts) reuse the shared `@qcobro/common` schemas directly.
 */

/** Input for `portfolios.list`. */
export const listPortfoliosSchema = z
  .object({
    includeArchived: z.boolean().optional()
  })
  .optional();
export type ListPortfoliosInput = z.infer<typeof listPortfoliosSchema>;

/** Input for `portfolios.get`. */
export const getPortfolioSchema = z.object({
  id: z.string().min(1)
});
export type GetPortfolioInput = z.infer<typeof getPortfolioSchema>;

/** Input for `portfolios.listAccounts`. */
export const listAccountsSchema = z.object({
  portfolioId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
});
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
