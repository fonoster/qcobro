## Why

The SDK ship added `auth.exchangeApiKey`, so unattended integrations can authenticate with a
workspace API key — but there is no way to **create** one. Keys can only be minted by calling the
Identity gRPC service directly, which no operator can do. Workspaces need a first-class surface to
issue, rotate, and revoke their own API keys so they can actually use `@qcobro/sdk` and other
server-to-server integrations.

## What Changes

- New webapp page at `/api-keys` ("Claves de API") in the **user-menu admin cluster** — next to
  _Miembros_ and _Configuración del espacio_ — for managing the active workspace's API keys.
  Lists existing keys (accessKeyId, role, expiry, created) and supports create, regenerate, and
  delete. The page is **gated to workspace owners/admins** (mirrors `WorkspaceSettings.activeRole`).
- **Create key**: pick a role and an optional expiry; the response includes the
  `accessKeySecret`, which is shown **exactly once** in a copy-to-clipboard dialog and never
  retrievable afterward.
- **Regenerate key**: rotates the secret in place (same `ref`/`role`), invalidating the old
  secret; the new secret is again shown once.
- **Delete key**: a **hard delete** — there is no soft-disable/revoke in Identity, so deleting a
  key _is_ the revocation. Type-to-confirm dialog, consistent with workspace deletion.
- New apiserver `apiKeys` tRPC router (`list`, `create`, `regenerate`, `delete`) on
  `protectedProcedure`, proxying to Fonoster Identity via the tRPC context. `list` never returns
  secrets.
- New `@qcobro/common` schemas for the API-key inputs/outputs (`createApiKeySchema`,
  `apiKeyRoleEnum`, `apiKeyRefSchema`, the secret-bearing and secret-free result shapes) as the
  single shared contract.
- **Upstream change:** the `@fonoster/identity-client` wrapper gains `createApiKey`,
  `listApiKeys`, `regenerateApiKey`, and `deleteApiKey` methods surfacing the Identity service's
  existing gRPC calls (the service already implements them; only the wrapper lacks them).
- **Out of scope:** any friendly-name/label for keys (Identity's `ApiKey` has no name field), a
  soft-disable/revoke distinct from delete (no such endpoint), per-key usage analytics, and
  scoped/granular permissions beyond the existing workspace `Role`.

## Capabilities

### New Capabilities

- `api-keys`: Workspace-scoped API-key lifecycle management — listing a workspace's keys (without
  secrets), creating a key with a role and optional expiry (secret returned once), regenerating a
  key's secret in place, and hard-deleting a key as the revocation mechanism. Covers the apiserver
  `apiKeys` router behavior, the shared schemas/validation, the owner/admin authorization gate,
  and the `/api-keys` operator page including the show-secret-once and confirm-delete flows.

### Modified Capabilities

<!-- None. `auth.exchangeApiKey` already shipped (sdk change); no existing spec's requirements change. -->

## Impact

- **Webapp:** new route `/api-keys` + page, a new "Claves de API" item in `UserMenu`, an i18n
  message group, and reuse of existing `Card`/`Button`/`InputGroup`/modal patterns.
- **Apiserver:** new `apiKeys` tRPC router wired into the root router; reaches Identity through the
  tRPC context (no ad-hoc imports).
- **Common:** new `src/schemas/apiKeys.ts` (and type exports) as the shared contract.
- **Upstream:** `@fonoster/identity-client` (sibling `../fonoster` repo) gains four wrapper methods
  and must be rebuilt before the apiserver typechecks against them.
- **No DB change in this repo** — API keys live in the Identity service's datastore.
