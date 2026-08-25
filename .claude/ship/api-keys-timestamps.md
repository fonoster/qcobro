# Ship checkpoint — api-keys-timestamps

Started: 2026-08-25
Current stage: 0 — Frame (done, entering Design)

**Scope:** Reverse the two workarounds the `api-keys` capability shipped 2026-06-23 with — no
createdAt column, no expiry input at creation — now that the root cause (Fonoster Identity's
int32 timestamp wire fields, previously fed epoch-ms values) is fixed upstream in a local
`fonoster/fonoster` worktree. Add the "Creada" column back and re-add the create-dialog expiry
input, converting ms→seconds at the one apiserver boundary that calls Identity.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                              |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | New OpenSpec change `api-keys-timestamps` created (the archived `api-keys` change from 2026-06-23 can't be resumed). `openspec validate` = valid. Upstream fix already implemented+tested+committed (not pushed) in `/Users/psanders/Projects/fonoster-worktrees/fix-apikey-timestamp-units`, branch `fix/apikey-timestamp-units`. |
| 1   | Design (Pencil) | pending |                                                                                                                                                                                                                                                                                                                                    |
| 2   | Spec reconcile  | pending | Delta spec already drafted at proposal time (MODIFIED: list + create requirements) — confirm/adjust after design.                                                                                                                                                                                                                  |
| 3   | Build           | pending |                                                                                                                                                                                                                                                                                                                                    |
| 4   | Test            | pending |                                                                                                                                                                                                                                                                                                                                    |
| 5   | Sync            | pending |                                                                                                                                                                                                                                                                                                                                    |
| 6   | Archive         | pending |                                                                                                                                                                                                                                                                                                                                    |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-08-25 — Frame done. This is a separate qcobro worktree/PR from the pending Members
  owner-name fix — do not touch Members.tsx here. Upstream root-cause fix for the int32
  timestamp bug already done this session in a fonoster worktree (createCreateApiKey.ts,
  createListApiKeys.ts, shared ApiKey type → epoch seconds; ctl's list command fixed to match;
  5/5 identity tests green; tsc -b clean across identity/ctl/sdk/identity-client/apiserver/
  dashboard). Not pushed/published yet — this qcobro change will consume a locally built copy
  for verification. Proposal/design/specs/tasks created via `openspec new change` +
  `opsx:propose`-style artifact authoring; `openspec validate api-keys-timestamps` = valid.
