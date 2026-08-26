# Ship checkpoint — api-keys-timestamps

Started: 2026-08-25
Current stage: 5 — Sync (gate — awaiting user confirmation)

**Scope:** Reverse the two workarounds the `api-keys` capability shipped 2026-06-23 with — no
createdAt column, no expiry input at creation — now that the root cause (Fonoster Identity's
int32 timestamp wire fields, previously fed epoch-ms values) is fixed upstream in a local
`fonoster/fonoster` worktree. Add the "Creada" column back and re-add the create-dialog expiry
input, converting ms→seconds at the one apiserver boundary that calls Identity.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (Playwright)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-- | :-------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | New OpenSpec change `api-keys-timestamps` created (the archived `api-keys` change from 2026-06-23 can't be resumed). `openspec validate` = valid. Upstream fix already implemented+tested+committed (not pushed) in `/Users/psanders/Projects/fonoster-worktrees/fix-apikey-timestamp-units`, branch `fix/apikey-timestamp-units`.                                                                                                                                                                                                                                     |
| 1   | Design (Pencil) | done    | Added "Creada" column (reused the dormant Status slot in the Comp/Table V2 instance) + expiry input in Crear modal (Input Group/Default). User asked for the two dates adjacent as the last two columns — swapped content between the Tipo/Status slots so order reads Access Key ID · Tipo · Creada · Expira. User approved.                                                                                                                                                                                                                                          |
| 2   | Spec reconcile  | done    | No behavior change beyond what the delta spec already captured (column order is layout, not spec-level). `openspec validate` = valid.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Build           | done    | apiserver ms→seconds conversion at the create boundary; webapp Row/mapping/column + expiry input in CreateApiKeyDialog (InputGroup date field, client-side future-date validation). i18n en/es. typecheck (common/apiserver/webapp) + lint clean.                                                                                                                                                                                                                                                                                                                      |
| 4   | Test            | done    | Unit: 6/6 apiKeys router tests green (added ms→seconds + no-expiry cases). Live e2e verification against the real running app (fresh signup+workspace, identity container swapped to the local fixed image via compose override): created a key with expiry → Creada 8/25/2026, Vence 12/30/2026 rendered correctly (no garbage/1970 dates); created a key with no expiry → "Sin vencimiento" rendered correctly. Deleted both test keys; reverted identity container back to the pinned `fonoster/identity:0.22.0` afterward — dev stack restored to its prior state. |
| 5   | Sync            | pending | Awaiting user go-ahead to promote the delta spec into `openspec/specs/api-keys/spec.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Archive         | pending |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
