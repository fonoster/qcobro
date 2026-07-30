import type { CreateTRPCClient } from "@trpc/client";
import type { AppRouter } from "@qcobro/apiserver";
import { z } from "zod";
import {
  createAgentTemplateSchema,
  syncAgentTemplateSchema,
  ValidationError
} from "@qcobro/common";
import { listAgentTemplatesSchema, getAgentTemplateSchema } from "../schemas.js";

type RouterClient = CreateTRPCClient<AppRouter>;
type AgentTemplates = RouterClient["agentTemplates"];

/** Input accepted by each agentTemplates method, derived from the server router. */
type ListInput = Parameters<AgentTemplates["list"]["query"]>[0];
type GetInput = Parameters<AgentTemplates["get"]["query"]>[0];
type CreateInput = Parameters<AgentTemplates["create"]["mutate"]>[0];
type SyncInput = Parameters<AgentTemplates["sync"]["mutate"]>[0];

/** Validate `input` against `schema`, throwing a structured {@link ValidationError} on failure. */
function parse<TSchema extends z.ZodType>(schema: TSchema, input: unknown): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

/** Runs a request, transparently refreshing + replaying once on `UNAUTHORIZED`. */
type RequestRunner = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Agent template operations.
 *
 * All methods are workspace-scoped: the {@link Client} must be authenticated and
 * have an active workspace selected. Inputs are validated client-side against the
 * shared `@qcobro/common` schemas before any request is sent — invalid input
 * throws a {@link ValidationError} and never reaches the network.
 *
 * `sync` re-attempts a voice template's Fonoster sync; it is not a
 * conversational-intelligence evaluation — QCobro has no such feature today.
 *
 * Obtain an instance via `client.agentTemplates`; do not construct it directly.
 */
export class AgentTemplatesResource {
  readonly #trpc: RouterClient;
  readonly #request: RequestRunner;

  /** @internal */
  constructor(trpc: RouterClient, request: RequestRunner) {
    this.#trpc = trpc;
    this.#request = request;
  }

  /** List the active workspace's agent templates. Filter by `type` and/or include archived ones. */
  async list(input?: ListInput) {
    const parsed = parse(listAgentTemplatesSchema, input) as ListInput;
    return this.#request(() => this.#trpc.agentTemplates.list.query(parsed));
  }

  /** Get a single agent template by id within the active workspace. */
  async get(input: GetInput) {
    const parsed = parse(getAgentTemplateSchema, input) as GetInput;
    return this.#request(() => this.#trpc.agentTemplates.get.query(parsed));
  }

  /** Create an agent template in the active workspace. `type` determines its required fields. */
  async create(input: CreateInput) {
    const parsed = parse(createAgentTemplateSchema, input) as CreateInput;
    return this.#request(() => this.#trpc.agentTemplates.create.mutate(parsed));
  }

  /**
   * Manually re-attempt the Fonoster sync for a voice agent template.
   *
   * On success `fonosterAppRef` is populated on the returned template; on
   * failure it stays saved locally with `fonosterAppRef` unset.
   */
  async sync(input: SyncInput) {
    const parsed = parse(syncAgentTemplateSchema, input) as SyncInput;
    return this.#request(() => this.#trpc.agentTemplates.sync.mutate(parsed));
  }
}
