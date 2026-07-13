## 1. Package scaffold

- [x] 1.1 Create `mods/mcp` with `package.json` (`@qcobro/mcp`, `"type": "module"`, `bin` → `./dist/index.js`, `main`/`types` per `@qcobro/sdk`'s pattern), mirroring sibling packages' scripts (`build`, `clean`, `typecheck`, `test`)
- [x] 1.2 Add `tsconfig.json` extending the root config (`outDir: dist`, `rootDir: src`, exclude `*.test.ts`); wire the package into the Lerna/workspace build order
- [x] 1.3 Add dependencies: `@qcobro/sdk`, `@qcobro/common`, `@modelcontextprotocol/sdk`, `zod`; dev deps `tsx`, `typescript`
- [x] 1.4 Create `src/index.ts` entrypoint that dispatches on `process.argv[2]`: no arg (or `serve`) starts the MCP server, `config` runs the config-writer

## 2. SDK schema exports (prerequisite)

- [x] 2.1 Export `listPortfoliosSchema`, `getPortfolioSchema`, `listAccountsSchema` from `mods/sdk/src/index.ts` (currently internal to `resources/portfolios.ts`) so `mods/mcp` can reuse them without duplicating validation rules
- [x] 2.2 Confirm `mods/sdk` build/typecheck/test still green after widening its exports

## 3. MCP server core

- [x] 3.1 Implement `src/env.ts`: read + assert `QCOBRO_ACCESS_KEY_ID`, `QCOBRO_ACCESS_KEY_SECRET`, `QCOBRO_WORKSPACE` (required), `QCOBRO_ENDPOINT` (optional, defaults to the SDK's default endpoint) — matching `@qcobro/common`'s `engine-eval` CLI env-var convention; fail fast with a clear error naming the missing variable
- [x] 3.2 Implement `src/utils/createClient.ts`: construct `new Client({ endpoint })`, `await client.loginWithApiKey({ accessKeyId, accessKeySecret })`, `client.useWorkspace(workspace)`, return the authenticated client
- [x] 3.3 Implement `src/server.ts` (or inline in `index.ts`'s `serve` path): construct `McpServer`, register tools, connect a `StdioServerTransport`
- [x] 3.4 Surface startup auth failures (invalid key) as a clear process-exit error, matching the SDK's `loginWithApiKey` failure behavior

## 4. Portfolio tools

- [x] 4.1 Implement `src/tools/portfoliosList.ts`: tool `portfolios_list`, schema `listPortfoliosSchema.shape`, delegates to `client.portfolios.list(input)`
- [x] 4.2 Implement `src/tools/portfoliosGet.ts`: tool `portfolios_get`, schema `getPortfolioSchema.shape`, delegates to `client.portfolios.get(input)`
- [x] 4.3 Implement `src/tools/portfoliosCreate.ts`: tool `portfolios_create`, schema `createPortfolioSchema.shape` (from `@qcobro/common`), delegates to `client.portfolios.create(input)`
- [x] 4.4 Implement `src/tools/portfoliosUpdate.ts`: tool `portfolios_update`, schema `updatePortfolioSchema.shape`, delegates to `client.portfolios.update(input)`
- [x] 4.5 Implement `src/tools/portfoliosDelete.ts`: tool `portfolios_delete`, schema `deletePortfolioSchema.shape`, delegates to `client.portfolios.delete(input)`
- [x] 4.6 Implement `src/tools/portfoliosListAccounts.ts`: tool `portfolios_list_accounts`, schema `listAccountsSchema.shape`, delegates to `client.portfolios.listAccounts(input)`
- [x] 4.7 Implement `src/tools/portfoliosSyncAccounts.ts`: tool `portfolios_sync_accounts`, schema `syncAccountsInputSchema.shape` (from `@qcobro/common`), delegates to `client.portfolios.syncAccounts(input)`
- [x] 4.8 Implement `src/tools/index.ts` `registerTools(server, client)` wiring all seven tools; each handler catches the SDK's `ValidationError`/`TRPCClientError` and returns an MCP error result rather than throwing raw

## 5. Config subcommand

- [x] 5.1 Implement `src/config/paths.ts`: resolve `claude_desktop_config.json` path per OS (macOS/Windows; throw a clear "unsupported platform" error otherwise)
- [x] 5.2 Implement `src/config/writeClaudeConfig.ts`: parse `--url` (default `https://api.qcobro.com`), require `--access-key-id`/`--access-key-secret`/`--workspace`; read existing config file (tolerate missing file; warn + start from `{ mcpServers: {} }` on parse failure); merge in a `qcobro` entry (`command: "npx"`, `args: ["-y", "@qcobro/mcp@latest"]`, `env` with the `QCOBRO_*` vars from §3.1); write the file (creating parent dirs as needed); print a confirmation
- [x] 5.3 Wire `config` subcommand parsing in `src/index.ts` (flags via `node:util` `parseArgs`, matching `engine-eval`'s `parseCliArgs`/`CliError`/`USAGE` pattern: `--url`, `--access-key-id`, `--access-key-secret`, `--workspace`); missing required flags fails with a clear error and no file write

## 6. Docs

- [x] 6.1 Write `mods/mcp/README.md`: install/setup, required env vars, tool list (name/inputs/outputs), `config` subcommand usage and example output, note that the API key's role fully controls what the server can do
- [x] 6.2 Add a Mintlify docs page (via `/ps:docs`) covering the same content for the public docs site (`docs-site/mcp/overview.mdx`, new "MCP" nav group), cross-linked from `/sdk/overview`

## 7. Tests

- [x] 7.1 Unit: `env.ts` throws a clear error for each missing required variable
- [x] 7.2 Unit: each tool handler delegates to the correct `client.portfolios.*` method with the parsed input (stub the SDK client)
- [x] 7.3 Unit: a tool called with invalid input returns a structured validation error and never reaches the stubbed client
- [x] 7.4 Unit: `writeClaudeConfig` — creates a new file when none exists; merges into an existing file preserving other `mcpServers` entries; defaults `--url`; falls back to empty config on unparseable existing file; errors (no write) when `--access-key-id`/`--access-key-secret`/`--workspace` missing
- [x] 7.5 Integration: golden path against a real stub tRPC server + real SDK `Client` + real `McpServer`, driven over an MCP `InMemoryTransport` client — list portfolios, create one, sync accounts, list accounts — asserting tool results match direct SDK calls
- [x] 7.6 Run repo `lint`, `typecheck`, and `test`; all green
