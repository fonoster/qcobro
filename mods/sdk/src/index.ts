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

// Re-export the shared structured error so callers can detect client-side
// validation failures without depending on `@qcobro/common` directly.
export { ValidationError, type FieldError } from "@qcobro/common";
