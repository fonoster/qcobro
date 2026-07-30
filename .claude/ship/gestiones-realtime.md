# Ship checkpoint — gestiones-realtime

Started: 2026-07-30
Current stage: 0 — Frame

**Scope:** Add a WebSocket-based tRPC subscription transport to apiserver, fed by a Prisma
extension on `accountContactLog`/`paymentPromise` writes, and wire it into the Gestiones list
and Gestión detail webapp screens so both update live without a manual refresh, with the
existing query/refetch path kept as the fallback. Scoped to these two screens only (issue #60).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen` at repo root) · Storybook: yes
(`mods/webapp/.storybook`) · E2E: yes (`playwright.config.ts`, `e2e/`)

**Autonomous run note:** pre-authorized by the repo owner to proceed through stages 5 (Sync)
and 6 (Archive) without pausing for human confirmation — this is a fully autonomous ship.

| #   | Stage           | Status | Notes                                                                                                                                                        |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Surfaces detected above.                                                                                                                                     |
| 1   | Design (Pencil) | done   | Checked; no new UI needed (see log).                                                                                                                         |
| 2   | Spec reconcile  | done   | No design changes to fold back; specs already validate.                                                                                                      |
| 3   | Build           | done   | Apiserver WS transport + Prisma extension + webapp hook/wiring + infra proxy configs.                                                                        |
| 4   | Test            | done   | 295 apiserver unit tests green; live e2e run caught + validated a real bug fix; lint/typecheck green across all packages.                                    |
| 5   | Sync            | done   | Delta specs merged into `openspec/specs/account-contact-log` and new `openspec/specs/realtime-streaming`; `openspec validate --all --strict` passes (44/44). |
| 6   | Archive         | done   | Moved to `openspec/changes/archive/2026-07-30-gestiones-realtime`; `openspec validate --all --strict` passes.                                                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-30 — Checkpoint created; framing the change. Proposal/design/tasks/specs already
  authored and validated via `openspec-propose` (slug `gestiones-realtime`).
- 2026-07-30 — Design stage: checked Pencil (`pencil.pen`) for the Gestiones list (frame
  `P01OL`, "Gestiones (WIP)" inside the "Gestiones + Promesas" cluster `vuSdS`) and all five
  Gestión-detail "bloque" panels (SMS `qjxF9`, Pre-grabada `h6wrw`, Voz IA `UJhkV`, Email
  `Y8lQc`, WhatsApp `s0cuz`). Read them in full: the list is a Toolbar (search + filter) over
  a static TableCard with example rows; the detail panels are header + channel-specific body
  - metadata, matching the shipped webapp closely. Grepped the whole document for any existing
    "connection status" / "live" / "en vivo" / "conectado" affordance used elsewhere in the
    console (sidebar, top bar, other feature clusters) — found none; the only "en vivo" hits are
    unrelated marketing/demo-script copy. No established idiom to mirror, and the realtime
    behavior here is signal-only refetch (existing row/detail rendering already handles new or
    changed data correctly once refetched) — a flash/badge affordance is not required for
    correctness or legibility. Decision: no Pencil changes needed for this change. Explicitly
    checked, not skipped.
- 2026-07-30 — Build stage complete. Apiserver: `contactLogEvents.ts` (EventEmitter bus +
  Prisma Client Extension covering every `accountContactLog`/`paymentPromise` write),
  `db.ts` wiring, `context.ts` refactored into shared `resolveAuth`/`resolveWorkspaceSettings`
  helpers used by both `createContext` (HTTP) and new `createWSContext` (WS, reads
  `connectionParams`), `index.ts` mounts `applyWSSHandler` on `/trpc-ws`, new
  `contactLogRouter.onChange` subscription. Webapp: `trpc.ts` gains a lazy `wsClient` +
  `splitLink`, new `useContactLogRealtime` hook wired into Gestiones list + Gestión detail.
  Infra: vite dev proxy, nginx `/trpc-ws` location, envoy comment (prefix match already
  covers it). Added `ws`/`@types/ws` as explicit apiserver deps.
- 2026-07-30 — Test stage complete. Wrote apiserver unit tests for the Prisma extension
  (8 cases) and the subscription's filtering (4 cases) — 295/295 apiserver tests green,
  full lint/typecheck green. Webapp has no unit-test infra in this repo (no vitest/jest/RTL,
  no `test` script) — decided NOT to introduce one for this change (out of scope for #60);
  substituted with a real e2e test instead.
- 2026-07-30 — Live e2e validation. Docker wasn't running initially; started it. Hit a port
  conflict with another concurrently-running agent's stack (`specoutreach-failure-
classification-db-1` on 5432, a vite dev server on 5173) — ran my own stack entirely on
  alternate local ports (db 5433, webapp 5199) via scratch-only, uncommitted overrides so as
  not to disturb the other agent; torn down completely afterward (verified via `docker ps`
  and `git status` that nothing shared was touched or left dirty). Wrote
  `e2e/gestiones-realtime.spec.ts` and ran it live: it FAILED on the first real run — the
  seeded gestión never streamed into the open list. Root-caused it: the Prisma extension's
  workspace-resolution lookup re-read the just-written `accountContactLog` row from a
  _separate_ (non-transactional) connection, but the real write path runs inside an
  interactive `$transaction` — the row wasn't committed yet, so the lookup silently found
  nothing and dropped the signal every time. Fixed by resolving via the write's own
  `portfolioAccountId` instead (a stable relation never touched by these transactions),
  added a regression unit test, reran — full golden path (list realtime + detail realtime
  via a second page acting as a second operator) passed. Also confirmed no regression in 7
  other existing e2e specs against the same live stack. CI will re-run the full e2e suite in
  an isolated environment as the authoritative check.
- 2026-07-30 — Proceeding through Sync and Archive without pausing for human confirmation,
  per explicit pre-authorization in this run's task instructions (autonomous ship).
- 2026-07-30 — Sync + Archive complete. All tasks in tasks.md checked off, 0 incomplete.
  Change archived to `openspec/changes/archive/2026-07-30-gestiones-realtime`. Next: commit,
  push, open PR, watch CI, merge.
