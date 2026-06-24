# Ship checkpoint — api-keys

Started: 2026-06-23
Current stage: DONE — archived 2026-06-23

**Scope:** Workspace-scoped API-key management. Add a dedicated `/api-keys` webapp page (in the
user-menu admin cluster, next to Miembros & Configuración del espacio) for listing, creating,
regenerating, and deleting API keys, backed by apiserver `apiKeys` tRPC router → Fonoster Identity.
Exchange (`auth.exchangeApiKey`) already shipped with the SDK; this adds the management surface.

**Contract (Fonoster Identity, verified):**

- `ApiKey = { ref, accessKeyId, role, expiresAt, createdAt, updatedAt }` — **no friendly name**, **no status/enabled field**.
- `createApiKey({ role, expiresAt? }) → { ref, accessKeyId, accessKeySecret }` (secret shown once).
- `regenerateApiKey(ref) → { ref, accessKeyId, accessKeySecret }` (rotate secret in place).
- `deleteApiKey(ref)` — **hard delete**; this IS revocation (no soft-disable exists).
- `listApiKeys(ListRequest) → ListResponse<ApiKey>` — never returns the secret.
- Roles: USER, WORKSPACE_OWNER, WORKSPACE_ADMIN, WORKSPACE_MEMBER. Owner is the human; assignable
  key roles TBD in design (likely ADMIN/MEMBER). Page gated to owner/admin (mirror WorkspaceSettings `activeRole`).

**Known upstream dependency (same pattern as SDK ship):** `@fonoster/identity-client` (in `../fonoster`)
currently wraps only `exchangeApiKey`. The 4 management methods (`createApiKey`, `listApiKeys`,
`regenerateApiKey`, `deleteApiKey`) exist in the Identity service but are NOT in the client wrapper —
they must be added upstream + rebuilt. Harness may block the out-of-repo edit; flag at build stage.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                                 |
| :-- | :-------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done   | OpenSpec change `api-keys` created + valid (4/4). Capability: `api-keys`. Placement decided; delete=revoke confirmed.                                                                                                                                                                 |
| 1   | Design (Pencil) | done   | Designed 4 screens in pencil.pen (Claves de API página + Crear/Secreto/Eliminar modals), copied from the Members admin screen + modals per the repo workaround. Placed in Application Flow → Cluster · ADMINISTRACIÓN (vVx5K rows TdAL3/AWXKM).                                       |
| 2   | Spec reconcile  | done   | No Pencil iteration → no design drift. Specs match locked Identity contract + `adminProcedure` gate. `openspec validate api-keys` = valid.                                                                                                                                            |
| 3   | Build           | done   | Upstream wrapper (not blocked) + router (adminProcedure) + common schemas + webapp (page, 2 dialog components+stories, route, gated menu item, i18n en/es). Reused DataTable/Dialog/ConfirmDeleteDialog/RowActionsMenu. Extracted `lib/workspaceRole.ts`. typecheck 4/4 + lint clean. |
| 4   | Test            | done   | Unit GREEN: 5 common schema + 5 apiserver router. E2E golden path VERIFIED live via screenshots (create→secret-once→list→regenerate→delete). Found+fixed 2 bugs (admin-only role; garbage createdAt→"—"). typecheck 4/4, lint+test clean.                                             |
| 5   | Sync            | done   | Promoted delta → openspec/specs/api-keys/spec.md (new capability). `openspec validate --all` = 24 passed, 0 failed.                                                                                                                                                                   |
| 6   | Archive         | done   | Moved to openspec/changes/archive/2026-06-23-api-keys. `openspec validate --all` = 23 passed, 0 failed. Ship complete.                                                                                                                                                                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-23 — Post-ship fix-up (user feedback). Smoke-tested the "expiry won't set" bug → root cause is
  upstream: Identity's proto types `expires_at`/`created_at`/`updated_at` as **int32**, but the service
  uses `new Date(value)` (epoch ms) — ms overflows int32 (rejected as "not positive"), seconds resolve to 1970. Can't work until Identity widens to int64. Per user: removed the expiry input from the create
  dialog (keys non-expiring; schema keeps optional expiresAt for forward-compat), then removed the
  garbage **Creada** column from the table. Also: RowActionsMenu trigger de-bordered + `cursor-pointer` +
  18px icon (user feedback). Regenerate reported broken but smoke test confirmed it works (user error).
  Updated spec (list/create requirements) + design D3/D5; `openspec validate` ok; typecheck 4/4 + lint
  clean. Pencil: removed CREADA from the page table + re-synced all 3 modal backgrounds; removed expiry
  field from the Crear modal. NOTE: Vite dev server now 404s `/api-keys` (restarted/lost SPA fallback) —
  blocks my screenshot captures, not the live HMR session.

- 2026-06-23 — Pencil back online → completed the deferred Stage 1 design. Built 4 screens (Claves de
  API página + Crear / Secreto-una-vez / Eliminar modals) by copying the Members screen + Invitar/Quitar
  modals (repo workaround), reworking the table to ACCESS KEY ID/ROL/VENCE/CREADA + actions, retitling,
  swapping fields (create = optional expiry + admin-role note; secret = two copy-rows + Listo; delete =
  red alert + CONFIRMAR input + Eliminar). Per user, moved all 4 into Application Flow → Cluster ·
  ADMINISTRACIÓN as two new rows. Verified each renders cleanly.

- 2026-06-23 — Live verification (user asked for screenshots). Stack healthy (db/identity ok). Drove the
  full workflow against the real backend via an API-seeded browser session (the signUpAndEnter helper has a
  pre-existing post-create token-claims race bouncing ALL specs to the picker — not this feature). Captured
  7 screenshots. **Two bugs found + fixed:** (1) API keys are ADMIN-ONLY per Identity's createApiKeyRequestSchema
  (corrected design D3, apiKeyRoleEnum, dialog drops role picker, schema/spec/tests); (2) Identity returns a
  negative/garbage createdAt for apiKeys.list (gRPC timestamp serialization bug — upstream; workspaces fine) →
  fmtDate degrades implausible dates to "—". Re-verified green (typecheck 4/4, lint, test 3/3). Still at Sync gate.
- 2026-06-23 — Stages 3+4 done. Built upstream wrapper (4 methods, NOT blocked), apiserver `apiKeys`
  router (adminProcedure), common schemas (reused workspaceRoleEnum), webapp page + CreateApiKeyDialog +
  ShowSecretDialog (+ stories) + gated UserMenu item + route + i18n (en/es). Reused DataTable/Dialog/
  ConfirmDeleteDialog/RowActionsMenu; extracted `lib/workspaceRole.ts` (also refactored WorkspaceSettings).
  Unit GREEN (10 tests). E2E written but UNVERIFIED: dev backend unhealthy (baseline spec fails identically
  at createFirstWorkspace). Paused at Sync gate.
- 2026-06-23 — Stages 1+2: Pencil SKIPPED (app unavailable, user away) → deferred TODO recorded; built UI
  from existing code patterns. No design drift → spec reconcile done, `openspec validate` valid.
- 2026-06-23 — Stage 0 done: created OpenSpec change `api-keys` via propose (proposal/design/specs/tasks),
  `openspec validate api-keys` = valid. Single capability `api-keys`. Design decisions D1–D7 recorded in
  design.md (placement, role-gating, assignable roles ADMIN/MEMBER, secret-shown-once, optional expiry as
  epoch ms, upstream wrapper, shared common schemas). Entering Pencil design stage.

- 2026-06-23 — Delete vs revoke clarified: Identity has no revoke/disable; delete is a hard delete and
  serves as revocation; regenerate rotates the secret in place. No soft-disable to spec.
- 2026-06-23 — **Placement (user choice): dedicated `/api-keys` page** in the user-menu admin cluster
  (next to Miembros & Configuración del espacio). Profile rejected (keys are workspace-scoped, not personal).
- 2026-06-23 — Frame: no prior change existed. `auth.exchangeApiKey` already shipped via SDK; Identity
  has full server-side CRUD. This ship adds the management router + UI. Checkpoint created.
