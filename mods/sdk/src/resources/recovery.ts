import type { CreateTRPCClient } from "@trpc/client";
import type { AppRouter } from "@qcobro/apiserver";
import {
  recoverySummaryInputSchema,
  recoveryBreakdownInputSchema,
  recoveryListInputSchema
} from "@qcobro/common";
import { parse } from "../validate.js";

type RouterClient = CreateTRPCClient<AppRouter>;
type Recovery = RouterClient["recovery"];

/** Input accepted by each recovery method, derived from the server router. */
export type RecoverySummaryParams = Parameters<Recovery["summary"]["query"]>[0];
export type RecoveryBreakdownParams = Parameters<Recovery["breakdown"]["query"]>[0];
export type RecoveryListParams = Parameters<Recovery["list"]["query"]>[0];

/** Runs a request, transparently refreshing + replaying once on `UNAUTHORIZED`. */
type RequestRunner = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Recovery (Recuperado) reads.
 *
 * Periods are calendar dates written `YYYY-MM-DD`, both inclusive, in the workspace's
 * timezone. All methods are workspace-scoped, and inputs are validated client-side against the
 * shared `@qcobro/common` schemas: invalid input throws a {@link ValidationError} and never
 * reaches the network.
 *
 * Obtain an instance via `client.recovery`; do not construct it directly.
 */
export class RecoveryResource {
  readonly #trpc: RouterClient;
  readonly #request: RequestRunner;

  /** @internal */
  constructor(trpc: RouterClient, request: RequestRunner) {
    this.#trpc = trpc;
    this.#request = request;
  }

  /** The amount recovered in a period, with and without a gestión, and the exits to classify. */
  async summary(input: RecoverySummaryParams) {
    const parsed = parse(recoverySummaryInputSchema, input) as RecoverySummaryParams;
    return this.#request(() => this.#trpc.recovery.summary.query(parsed));
  }

  /**
   * The amount recovered in a period, grouped by `CAMPAIGN`, `CHANNEL`, `OUTCOME` or
   * `DAYS_SINCE_TOUCH`. `additive` is `false` only for `CAMPAIGN`: every campaign active on an
   * account is credited the full amount.
   */
  async breakdown(input: RecoveryBreakdownParams) {
    const parsed = parse(recoveryBreakdownInputSchema, input) as RecoveryBreakdownParams;
    return this.#request(() => this.#trpc.recovery.breakdown.query(parsed));
  }

  /** A page of the recoveries detected in a period, with the total count. */
  async list(input: RecoveryListParams) {
    const parsed = parse(recoveryListInputSchema, input) as RecoveryListParams;
    return this.#request(() => this.#trpc.recovery.list.query(parsed));
  }
}
