/**
 * `@qcobro/sdk` — a developer-friendly TypeScript SDK for the QCobro API.
 *
 * Construct a {@link Client}, authenticate, select a workspace, and call typed
 * resource methods (e.g. {@link Client.portfolios}).
 *
 * @packageDocumentation
 */

export { Client } from "./client.js";
export type { ClientOptions, Tokens } from "./client.js";
export { PortfoliosResource } from "./resources/portfolios.js";

// Schemas for inputs the apiserver defines inline (not in `@qcobro/common`), so
// other packages (e.g. `@qcobro/mcp`) can validate against the same rules the
// SDK itself uses, without duplicating them.
export { listPortfoliosSchema, getPortfolioSchema, listAccountsSchema } from "./schemas.js";
export type { ListPortfoliosInput, GetPortfolioInput, ListAccountsInput } from "./schemas.js";

// Re-export the shared structured error so callers can detect client-side
// validation failures without depending on `@qcobro/common` directly.
export { ValidationError, type FieldError } from "@qcobro/common";
