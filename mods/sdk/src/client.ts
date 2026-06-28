import { createTRPCClient, httpBatchLink, type CreateTRPCClient } from "@trpc/client";
import type { AppRouter } from "@qcobro/apiserver";
import type { LoginInput, ApiKeyLoginInput } from "@qcobro/common";
import { PortfoliosResource } from "./resources/portfolios.js";

/** Header the apiserver reads to scope a request to a workspace. */
const WORKSPACE_HEADER = "x-workspace";

/** Default QCobro API base URL, used when no `endpoint` is provided. */
const DEFAULT_ENDPOINT = "https://api.qcobro.com";

/** Tokens issued by the QCobro Identity service. */
export interface Tokens {
  /** Short-lived bearer token attached to every authenticated request. */
  accessToken?: string;
  /** Long-lived token used to obtain a fresh access token via {@link Client.refresh}. */
  refreshToken?: string;
  /** JWT describing the authenticated user (claims), when issued. */
  idToken?: string;
}

/** Options for constructing a {@link Client}. */
export interface ClientOptions {
  /**
   * Base URL of the QCobro API. Defaults to `https://api.qcobro.com`; override
   * only to target another environment (e.g. `http://localhost:3000`). The SDK
   * appends the `/trpc` path itself.
   */
  endpoint?: string;
  /**
   * `fetch` implementation to use. Defaults to the global `fetch` (Node ≥18 and
   * modern browsers). Provide this to supply a polyfill in older runtimes.
   */
  fetch?: typeof globalThis.fetch;
  /** An access token to start authenticated, instead of calling {@link Client.login}. */
  accessToken?: string;
  /** A refresh token, enabling {@link Client.refresh} without re-login. */
  refreshToken?: string;
  /** The accessKeyId of the workspace to act in. Also settable via {@link Client.useWorkspace}. */
  workspace?: string;
  /**
   * When `true` (the default), an `UNAUTHORIZED` response triggers a single
   * token refresh and one replay of the failed request, provided a refresh
   * token is held. Set to `false` to disable and surface `UNAUTHORIZED` directly.
   */
  autoRefresh?: boolean;
}

/**
 * The QCobro API client.
 *
 * A single `Client` owns the connection and the authentication lifecycle, and
 * exposes resources as namespaces with friendly methods (e.g.
 * {@link Client.portfolios}). It transparently attaches the bearer token and the
 * active-workspace header to every request.
 *
 * Tokens are held **in memory only** — persisting them (if you want sessions to
 * survive a restart) is the caller's responsibility via {@link Client.getTokens}
 * and {@link Client.setTokens}.
 *
 * @example
 * ```ts
 * const client = new Client();
 * await client.login({ email: "me@acme.com", password: "secret" });
 * client.useWorkspace("ws_123");
 *
 * await client.portfolios.create({ name: "Q3 delinquencies", clientId: "acme" });
 * const portfolios = await client.portfolios.list();
 * ```
 */
export class Client {
  /**
   * The underlying typed tRPC proxy. Exposed as an escape hatch for procedures
   * the SDK does not yet wrap; prefer the resource namespaces where available.
   */
  readonly trpc: CreateTRPCClient<AppRouter>;

  /** Portfolio operations (list, get, create, update, delete, accounts, sync). */
  readonly portfolios: PortfoliosResource;

  #accessToken?: string;
  #refreshToken?: string;
  #workspace?: string;
  #autoRefresh: boolean;
  // Shared in-flight refresh, so concurrent UNAUTHORIZED calls refresh once.
  #refreshInFlight: Promise<void> | null = null;

  constructor(options: ClientOptions = {}) {
    this.#accessToken = options.accessToken;
    this.#refreshToken = options.refreshToken;
    this.#workspace = options.workspace;
    this.#autoRefresh = options.autoRefresh ?? true;

    const url = `${(options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "")}/trpc`;
    this.trpc = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url,
          fetch: options.fetch,
          // Read current auth state on every request so a `login()` or
          // `useWorkspace()` after construction applies without rebuilding.
          headers: () => {
            const headers: Record<string, string> = {};
            if (this.#accessToken) headers.Authorization = `Bearer ${this.#accessToken}`;
            if (this.#workspace) headers[WORKSPACE_HEADER] = this.#workspace;
            return headers;
          }
        })
      ]
    });

    this.portfolios = new PortfoliosResource(this.trpc, (fn) => this.request(fn));
  }

  /**
   * Run a request, transparently refreshing the access token once on an
   * `UNAUTHORIZED` error and replaying the request. Used internally by the
   * resource namespaces.
   *
   * Refresh happens at most once per failed request: if the replay also fails,
   * that error is surfaced (no retry loop). Concurrent failures share a single
   * in-flight refresh. If auto-refresh is disabled, no refresh token is held, or
   * the refresh itself fails, the original error is surfaced unchanged.
   *
   * @internal
   */
  async request<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!this.#shouldRefresh(err)) throw err;
      try {
        await this.#refreshOnce();
      } catch {
        // Refresh failed (e.g. expired refresh token) — surface the original
        // auth error rather than the refresh failure.
        throw err;
      }
      return fn();
    }
  }

  #shouldRefresh(err: unknown): boolean {
    if (!this.#autoRefresh || !this.#refreshToken) return false;
    return (err as { data?: { code?: string } } | null)?.data?.code === "UNAUTHORIZED";
  }

  #refreshOnce(): Promise<void> {
    if (!this.#refreshInFlight) {
      this.#refreshInFlight = this.refresh()
        .then(() => undefined)
        .finally(() => {
          this.#refreshInFlight = null;
        });
    }
    return this.#refreshInFlight;
  }

  /**
   * Authenticate with email and password. On success the issued access (and
   * refresh) token is stored on the client and used for subsequent calls.
   *
   * @returns the issued tokens.
   */
  async login(input: LoginInput): Promise<Tokens> {
    const tokens = await this.trpc.auth.login.mutate(input);
    this.#accessToken = tokens.accessToken;
    this.#refreshToken = tokens.refreshToken;
    return tokens;
  }

  /**
   * Authenticate with a workspace API key (accessKeyId + accessKeySecret),
   * intended for unattended, server-to-server integrations. On success the
   * issued access (and refresh) token is stored on the client and used for
   * subsequent calls.
   *
   * @returns the issued tokens.
   *
   * @example
   * ```ts
   * await client.loginWithApiKey({
   *   accessKeyId: "ak_workspace_123",
   *   accessKeySecret: process.env.QCOBRO_API_SECRET!
   * });
   * ```
   */
  async loginWithApiKey(input: ApiKeyLoginInput): Promise<Tokens> {
    const tokens = await this.trpc.auth.exchangeApiKey.mutate(input);
    this.#accessToken = tokens.accessToken;
    this.#refreshToken = tokens.refreshToken;
    return tokens;
  }

  /**
   * Exchange a refresh token for a fresh access token. Uses the refresh token
   * held by the client unless one is passed explicitly. The new access token
   * replaces the current one.
   *
   * @returns the issued tokens.
   */
  async refresh(refreshToken?: string): Promise<Tokens> {
    const token = refreshToken ?? this.#refreshToken;
    if (!token) {
      throw new Error("No refresh token available; pass one or call login() first.");
    }
    const tokens = await this.trpc.auth.refresh.mutate({ refreshToken: token });
    this.#accessToken = tokens.accessToken;
    if (tokens.refreshToken) this.#refreshToken = tokens.refreshToken;
    return tokens;
  }

  /**
   * Select the active workspace by its accessKeyId. Subsequent workspace-scoped
   * calls act within this workspace.
   */
  useWorkspace(accessKeyId: string): this {
    this.#workspace = accessKeyId;
    return this;
  }

  /** The accessKeyId of the active workspace, or `undefined` if none is selected. */
  get workspace(): string | undefined {
    return this.#workspace;
  }

  /** Returns the tokens currently held by the client (in memory). */
  getTokens(): Tokens {
    return { accessToken: this.#accessToken, refreshToken: this.#refreshToken };
  }

  /**
   * Replace the tokens held by the client. Useful to resume a session from
   * tokens you persisted yourself.
   */
  setTokens(tokens: Tokens): this {
    this.#accessToken = tokens.accessToken;
    this.#refreshToken = tokens.refreshToken;
    return this;
  }
}
