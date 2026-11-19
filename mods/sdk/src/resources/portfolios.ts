import type { CreateTRPCClient } from "@trpc/client";
import type { AppRouter } from "@qcobro/apiserver";
import { z } from "zod";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  syncAccountsInputSchema,
  listExitsInputSchema,
  classifyExitsInputSchema,
  ValidationError
} from "@qcobro/common";
import { listPortfoliosSchema, getPortfolioSchema, listAccountsSchema } from "../schemas.js";

type RouterClient = CreateTRPCClient<AppRouter>;
type Portfolios = RouterClient["portfolios"];

/** Input accepted by each portfolios method, derived from the server router. */
type ListInput = Parameters<Portfolios["list"]["query"]>[0];
type GetInput = Parameters<Portfolios["get"]["query"]>[0];
type CreateInput = Parameters<Portfolios["create"]["mutate"]>[0];
type UpdateInput = Parameters<Portfolios["update"]["mutate"]>[0];
type DeleteInput = Parameters<Portfolios["delete"]["mutate"]>[0];
type ListAccountsInput = Parameters<Portfolios["listAccounts"]["query"]>[0];
type SyncAccountsInput = Parameters<Portfolios["syncAccounts"]["mutate"]>[0];
type ListExitsInput = Parameters<Portfolios["listExits"]["query"]>[0];
type ClassifyExitsInput = Parameters<Portfolios["classifyExits"]["mutate"]>[0];

/** Validate `input` against `schema`, throwing a structured {@link ValidationError} on failure. */
function parse<TSchema extends z.ZodType>(schema: TSchema, input: unknown): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

/**
 * Portfolio operations.
 *
 * All methods are workspace-scoped: the {@link Client} must be authenticated and
 * have an active workspace selected. Inputs are validated client-side against the
 * shared `@qcobro/common` schemas before any request is sent — invalid input
 * throws a {@link ValidationError} and never reaches the network.
 *
 * Obtain an instance via `client.portfolios`; do not construct it directly.
 */
/** Runs a request, transparently refreshing + replaying once on `UNAUTHORIZED`. */
type RequestRunner = <T>(fn: () => Promise<T>) => Promise<T>;

export class PortfoliosResource {
  readonly #trpc: RouterClient;
  readonly #request: RequestRunner;

  /** @internal */
  constructor(trpc: RouterClient, request: RequestRunner) {
    this.#trpc = trpc;
    this.#request = request;
  }

  /** List the active workspace's portfolios. Pass `includeArchived` to include archived ones. */
  async list(input?: ListInput) {
    const parsed = parse(listPortfoliosSchema, input) as ListInput;
    return this.#request(() => this.#trpc.portfolios.list.query(parsed));
  }

  /** Get a single portfolio by id within the active workspace. */
  async get(input: GetInput) {
    const parsed = parse(getPortfolioSchema, input) as GetInput;
    return this.#request(() => this.#trpc.portfolios.get.query(parsed));
  }

  /** Create a portfolio in the active workspace. */
  async create(input: CreateInput) {
    const parsed = parse(createPortfolioSchema, input) as CreateInput;
    return this.#request(() => this.#trpc.portfolios.create.mutate(parsed));
  }

  /** Update a portfolio. Set `archived: true` to archive it, `false` to restore it. */
  async update(input: UpdateInput) {
    const parsed = parse(updatePortfolioSchema, input) as UpdateInput;
    return this.#request(() => this.#trpc.portfolios.update.mutate(parsed));
  }

  /** Delete a portfolio in the active workspace. */
  async delete(input: DeleteInput) {
    const parsed = parse(deletePortfolioSchema, input) as DeleteInput;
    return this.#request(() => this.#trpc.portfolios.delete.mutate(parsed));
  }

  /** List a page of a portfolio's accounts, with the total count. */
  async listAccounts(input: ListAccountsInput) {
    const parsed = parse(listAccountsSchema, input) as ListAccountsInput;
    return this.#request(() => this.#trpc.portfolios.listAccounts.query(parsed));
  }

  /**
   * Synchronize a batch of account rows into a portfolio.
   *
   * `mode` controls the merge strategy: `APPEND_ONLY` adds new rows,
   * `UPDATE_EXISTING` updates rows that already exist, `REPLACE` replaces the set.
   * Pass `exits` to record accounts that left the portfolio, with a reason; `CAUGHT_UP` and
   * `PAID_OFF` exits also carry `missedInstallments` and `termsAmount`.
   */
  async syncAccounts(input: SyncAccountsInput) {
    const parsed = parse(syncAccountsInputSchema, input) as SyncAccountsInput;
    return this.#request(() => this.#trpc.portfolios.syncAccounts.mutate(parsed));
  }

  /**
   * List a page of the accounts that left a portfolio and have not come back, with the total
   * count. Pass `reason` to filter, e.g. `UNKNOWN` for the exits still to classify.
   */
  async listExits(input: ListExitsInput) {
    const parsed = parse(listExitsInputSchema, input) as ListExitsInput;
    return this.#request(() => this.#trpc.portfolios.listExits.query(parsed));
  }

  /**
   * Assign a reason to exits recorded as `UNKNOWN`. `CAUGHT_UP` and `PAID_OFF` exits carry
   * `missedInstallments` and `termsAmount` and record a recovery of their product.
   */
  async classifyExits(input: ClassifyExitsInput) {
    const parsed = parse(classifyExitsInputSchema, input) as ClassifyExitsInput;
    return this.#request(() => this.#trpc.portfolios.classifyExits.mutate(parsed));
  }
}
