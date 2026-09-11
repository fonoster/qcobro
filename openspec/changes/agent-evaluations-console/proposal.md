## Why

Agent evaluations exist as SDK/apiserver surface (`client.agentEvaluations.evaluate`,
`client.agentTemplates.preview` — see `openspec/changes/agent-evaluations/`, implementation
complete but not yet archived/synced) reachable only via `qcobro ctl agents:eval`/`preview`
from a local YAML file. An operator working in the webapp has no way to author a scenario,
run it, or see the result — every evaluation today requires a developer with CLI access and a
hand-written YAML fixture. That change's own proposal explicitly scoped a console UI and
persisted runs as **Non-Goals**: _"A UI for running evals in the operator console — this
change is SDK/APIServer surface only"_ and _"Persisting eval runs as first-class workspace
data."_ This change fills exactly that gap: an operator can build up a reusable scenario
library per agent template, run it, and see pass/fail with per-turn detail and tool calls,
entirely from the console.

## What Changes

- **New persisted `Scenario`** — a reusable, workspace-scoped fixture (account context +
  ordered turns with optional `expected` assertions) owned by one `AgentTemplate`, restricted
  to `VOICE_AI`/`EMAIL`/`WHATSAPP` (the only channels `agentEvaluations.evaluate` accepts).
  Create/edit/delete/list from the console; stores the exact `EvalScenario` shape
  (`@qcobro/common`) `evaluateExistingTargetSchema` already expects, so a saved scenario runs
  unmodified.
- **New persisted `EvaluationRun`** — a durable history record per run: status
  (`RUNNING`/`COMPLETE`/`ERROR`/`INTERRUPTED`), verdict, turn counts, a snapshot of the
  scenario as it was at run time, and the full ordered `EvalEvent` stream. Written
  incrementally by the apiserver as `agentEvaluations.evaluate`'s existing generator streams
  events — the streaming contract to the caller is unchanged, this is a side effect layered
  onto the same subscription.
- **New `scenarios` tRPC router** — workspace- and template-scoped CRUD, following the
  existing `whatsAppIntegration.listSenders`/`addSender`/`removeSender` +
  validated-function-with-ownership-check pattern.
- **New report endpoint** — renders a persisted `EvaluationRun` as HTML/PDF/JSON by reusing
  the CLI's existing report builder (`buildReportModel`/`renderHtml`/`renderPdf`, currently in
  `mods/ctl/src/evalReport.ts`) rather than re-implementing report generation. Requires
  relocating that (framework-free) module into `@qcobro/common` under a new `./reporting`
  subpath export, since `mods/apiserver` cannot depend on `@qcobro/ctl` (oclif/CLI dependency
  tree) and the webapp must never bundle `pdfmake`.
- **New webapp UI, nested under Agent Template detail** (`AgentTemplateDetail.tsx`) as new
  tabs — deliberately not a new top-level nav section, to keep this bounded to one entity's
  detail page rather than a parallel "Evaluations" IA:
  - `Escenarios` / `Ejecuciones` tabs for `VOICE_AI`/`EMAIL`/`WHATSAPP` templates: scenario
    list + create/edit modal (turn editor), run history + live-streaming run detail (pass/fail,
    per-turn results, tool calls, judge reasoning), downloadable report.
  - A single `Vista previa` tab for `SMS`/`VOICE_PRERECORDED` templates: a thin form against
    the existing `agentTemplates.preview` query — no scenarios, no persistence, no scoring.
  - First real usage of the app's existing (currently unused) `Tabs` component.
- **v1 scope**: one scenario per run (no batch/multi-scenario run from the console, even
  though the underlying schema supports an array) — kept to bound the UI surface; noted as a
  fast-follow.

## Capabilities

### New Capabilities

- `agent-evaluations-console`: persisted `Scenario`/`EvaluationRun` data, the `scenarios`
  CRUD router, run-persistence behavior layered onto the existing evaluation stream, the
  report-download endpoint, and the webapp screens (Escenarios/Ejecuciones/Vista previa tabs
  on Agent Template detail). Named apart from `agent-evaluations` (the underlying streaming
  eval engine, SDK/CLI-facing) the same way that change's own proposal separated itself from
  `engine-scorecard` — this capability is operator-facing persistence + console UI built on
  top of that engine, not the engine itself.

### Modified Capabilities

- `web-console`: adds the nested-tabs IA constraint (evaluation screens live on the entity
  detail page they belong to, not a parallel nav section) as a general shell/navigation
  assertion, not scoped only to this feature.

## Impact

- **`mods/apiserver`**: new Prisma models (`Scenario`, `EvaluationRun`) + migration; new
  `scenarios` router + validated functions; the `agentEvaluations.evaluate` subscription
  handler gains a persistence wrapper; new `evaluationRuns.report` procedure.
- **`mods/common`**: relocates `evalReport.ts` (currently `mods/ctl/src/evalReport.ts`) to a
  new `./reporting` subpath export; adds a thin `createScenario`/`updateScenario` input schema
  wrapping the existing `evalScenarioSchema` with an `agentTemplateId` pointer.
- **`mods/ctl`**: updates its one import of `evalReport.ts` to the new location; no behavior
  change (`evalReport.test.ts` must stay green).
- **`mods/webapp`**: `AgentTemplateDetail.tsx` gains channel-conditional tabs; new components
  (turn/step row, scenario turn editor, run-detail live-stream view, preview panel); new
  `useEvaluationRunStream` hook (payload-streaming, distinct from the existing signal-only
  `useContactLogRealtime`); new i18n keys (`agents.scenarios.*`, `agents.runs.*`,
  `agents.preview.*`) in both `en`/`es`.
- **Pencil (`pencil.pen`)**: new frames in the existing `Agentes`/`Agentes Modals` clusters
  (see `design.md`); one new component (`Label/Error`, a fifth badge variant alongside the
  existing success/orange/violet/secondary labels).
- **Depends on** `openspec/changes/agent-evaluations/` (SDK/apiserver evaluation engine,
  implementation-complete but not yet archived/synced into `openspec/specs/`) for
  `evalScenarioSchema`, `EvalEvent`, the `agentEvaluations.evaluate` subscription, and
  `agentTemplates.preview`. That change is not modified here and is not listed under Modified
  Capabilities because it has no synced spec yet to diff against — **archiving it first is a
  prerequisite worth doing before this change reaches Sync, so `agent-evaluations` exists as a
  real capability to declare a delta against; left for explicit user approval, not done as
  part of this proposal** (see `design.md`'s Open Questions).
