import { z } from "zod";

export * from "./errors/index.js";
export * from "./utils/index.js";
export * from "./schemas/index.js";
export * from "./types/index.js";
export * from "./config.js";

/**
 * Placeholder contract proving the shared-schema pattern.
 *
 * `common` is the single source of truth for domain types and Zod schemas,
 * imported by both the apiserver (input validation) and the webapp (forms/types).
 * Real domain schemas (portfolios, accounts, Objectives, ...) arrive in a later
 * change; this entry exists so the contract pattern is wired end to end.
 */
export const PingInput = z.object({
  message: z.string().min(1).max(280)
});

export type PingInput = z.infer<typeof PingInput>;
