## Context

`openspec/changes/agent-evaluations/` shipped a fully working streaming evaluation engine
(SDK `client.agentEvaluations.evaluate`, apiserver subscription over the existing WebSocket
tRPC transport, VOICE_AI via Fonoster AUTOPILOT, EMAIL/WHATSAPP via the existing autopilot
decision loop, an entity-faithful `TextSimilarityJudge` for graded `SIMILAR` text) plus a
render-only `agentTemplates.preview` for SMS/VOICE_PRERECORDED. Its own Non-Goals section
ruled out both a console UI and persisting runs. Today the only consumer is
`qcobro ctl agents:eval`/`preview`, reading scenarios from a local YAML file and writing
reports to local files — nothing is stored server-side, and nothing is reachable without CLI
access.

This change adds exactly the two things that were deliberately deferred: durable, reusable
`Scenario`s an operator authors in the console, and `EvaluationRun` history so pass/fail
results survive the page. Both build directly on the existing engine's shapes
(`EvalScenario`, `EvalEvent`) rather than inventing parallel ones.

The user explicitly flagged a risk going in: this becoming "design heavy" given how much data
a run naturally carries (turns, tool calls, judge reasoning, a report). The scope decisions
below (nested tabs not a new nav section, one scenario per run, reuse the CLI's report
renderer, reuse existing badge/accordion/modal components) are all direct responses to that
risk, not just implementation convenience.

## Goals / Non-Goals

**Goals:**

- Let an operator build a reusable scenario library per `VOICE_AI`/`EMAIL`/`WHATSAPP` agent
  template, entirely in the console, with no YAML/CLI involved.
- Run a scenario and watch results stream turn-by-turn, exactly mirroring what
  `agents:eval`'s live output already shows — pass/fail, tool calls, judge reasoning.
- Keep a durable history of runs per template so results are still there after navigating
  away, refreshing, or coming back the next day.
- Let SMS/VOICE_PRERECORDED templates get a fast render-only preview, matching what the
  backend already supports, without pretending they have a conversation to evaluate.
- Reuse the CLI's existing report renderer (`evalReport.ts`) for the console's downloadable
  report instead of a second implementation.
- Bound the UI surface: nested tabs on the existing Agent Template detail page, not a new
  top-level "Evaluations" section; one scenario per run, not a batch-run UI.

**Non-Goals:**

- Running multiple scenarios in a single console-triggered run (the schema supports an array;
  the console UI and `EvaluationRun`'s single-scenario snapshot do not, in v1).
- Any change to the evaluation engine itself (Fonoster integration, the autopilot decision-loop
  runner, judge grading) — this change only adds persistence and UI around the existing
  generator.
- Scheduling/recurring runs, alerting on regressions, or diffing runs against each other —
  pure "author, run, view" for v1.
- Archiving/syncing `openspec/changes/agent-evaluations/` — a real prerequisite for this
  change to cleanly declare a delta against that capability later, but a separate,
  independently-gated decision (see Open Questions), not bundled into this change's diff.

## Decisions

### `Scenario` and `EvaluationRun` are new, workspace-scoped Prisma models under `AgentTemplate`

Modeled after `WhatsAppSenderNumber` (`schema.prisma:366-381`) rather than parent-join-only
children like `CampaignTrigger`: both get their own `id` and `workspaceRef` (not just an
`agentTemplateId` FK), because both need direct, workspace-scoped list queries the way sender
numbers do, not just "children of one already-loaded parent."

```prisma
model Scenario {
  id              String          @id @default(uuid())
  workspaceRef    String
  agentTemplateId String
  ref             String
  description     String?
  definition      Json            // full EvalScenario shape — {ref, description, account, turns[]}
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  agentTemplate   AgentTemplate   @relation(fields: [agentTemplateId], references: [id], onDelete: Cascade)
  runs            EvaluationRun[]

  @@unique([agentTemplateId, ref])
  @@index([workspaceRef])
  @@map("scenarios")
}

model EvaluationRun {
  id                  String          @id @default(uuid())
  workspaceRef        String
  agentTemplateId     String
  scenarioId          String?         // SetNull: a run outlives its Scenario being edited/deleted
  scenarioRef         String          // snapshot, taken from the same input the run executed
  scenarioDescription String?
  scenarioAccount     Json?
  status              RunStatus       @default(RUNNING)
  verdict             RunVerdict?
  passedTurns         Int             @default(0)
  totalTurns          Int             @default(0)
  events              Json            @default("[]")   // full ordered EvalEvent[] stream
  startedAt           DateTime        @default(now())
  completedAt         DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  agentTemplate       AgentTemplate   @relation(fields: [agentTemplateId], references: [id], onDelete: Cascade)
  scenario            Scenario?       @relation(fields: [scenarioId], references: [id], onDelete: SetNull)

  @@index([workspaceRef])
  @@index([agentTemplateId, createdAt])
  @@map("evaluation_runs")
}

enum RunStatus { RUNNING COMPLETE ERROR INTERRUPTED }
enum RunVerdict { PASS FAIL }
```

`Scenario.definition` stores `evalScenarioSchema`'s shape verbatim (`@qcobro/common`), so
running a saved scenario is `{ agentTemplateId, scenarios: [scenario.definition] }` with no
reshaping. `EvaluationRun.events` stores the full `EvalEvent[]` stream verbatim — one column
is what both the in-app run view and the report builder replay; no separate per-turn/tool-call
tables. `scenarioRef`/`scenarioDescription`/`scenarioAccount` are a snapshot (not a live join)
specifically so a report built from an old run is unaffected by later edits to the scenario.

**Alternative considered:** normalize turns/tool-calls into their own tables for queryability
(e.g. "find all failing turns mentioning tool X"). Rejected for v1 — no such query is needed
yet, and it would multiply the schema and the report-reconstruction logic for no current
benefit; the JSON-blob approach is also what lets the exact same `EvalEvent[]` feed both the
live-streaming view and the historical view with one shape.

### Run persistence happens server-side, inside the existing subscription generator

The router wraps the existing `createEvaluateAgent(...)` generator rather than the webapp
saving a run via a separate mutation after the stream completes:

```ts
evaluate: workspaceProcedure.input(evaluateInputSchema).subscription(async function* ({ input, ctx }) {
  const run = await startEvaluationRun(ctx.prisma, ctx.workspace.accessKeyId, input); // RUNNING
  const events: EvalEvent[] = [];
  try {
    for await (const event of createEvaluateAgent(...)(input)) {
      events.push(event);
      yield event;
    }
    await finalizeEvaluationRun(ctx.prisma, run.id, events); // COMPLETE + verdict/counts
  } catch (err) {
    await finalizeEvaluationRun(ctx.prisma, run.id, events, "ERROR");
    throw err;
  }
})
```

Chosen over "webapp accumulates events client-side and POSTs them on `onComplete`" because the
server is already the sole producer of events (no bus to duplicate into), the run row exists
the instant it starts (so a page navigated away from mid-run still shows something, not
nothing, in history), and it avoids re-serializing a potentially large event array back over
the wire in a second round trip.

**Console-only constraint this implies:** the console never uses `evaluateYamlTargetSchema`
(the YAML-before-creation branch stays CLI/SDK-only) — it always sends
`{ agentTemplateId, scenarios: [scenario.definition] }`, so `startEvaluationRun` can assume
`input.scenarios[0]` for the snapshot fields. This doesn't change the schema (still a union),
only how the console happens to use it.

### The report renderer moves from `mods/ctl` to `@qcobro/common/reporting`

`mods/ctl/src/evalReport.ts` (`buildReportModel`/`renderHtml`/`renderPdf`, already
framework-free — "pure, oclif-free builders" per its own comment) is the one piece of report
logic that must be shared between the CLI and the new apiserver endpoint. `mods/apiserver`
cannot depend on `@qcobro/ctl` (oclif/`@inquirer`/`chalk`/`cliui` — a CLI dependency tree with
no place in a server process; today's dependency direction is `ctl → sdk → common`, apiserver
is never downstream of ctl).

Move it to a **new subpath export** — `mods/common/src/reporting/evalReport.ts`, with
`package.json` gaining `"./reporting": "./dist/reporting/index.js"` alongside the existing
root `"."` export — rather than the root barrel. `evalReport.ts` imports `pdfmake` and mutates
`pdfMake.vfs` at module scope; the webapp already imports `@qcobro/common` (root) for schemas
today, and a bare re-export would risk that side-effecting assignment reaching the webapp
bundle depending on how aggressively the bundler tree-shakes it. A dedicated subpath keeps
`ctl` and `apiserver` both importing `@qcobro/common/reporting` while the webapp never touches
`pdfmake` at all. `ctl`'s `commands/agents/eval.ts` updates its one import path;
`evalReport.test.ts` moves with the module and must stay green — behavior is unchanged, only
location.

### One scenario per run in the console (v1)

`evaluateExistingTargetSchema` already accepts `scenarios: EvalScenario[]` (plural) and
`EvalEvent`'s `summary` event already aggregates across scenarios — the engine has no
limitation here. The console UI and `EvaluationRun`'s single-`scenarioId`/`scenarioRef`
snapshot are what's scoped to one-at-a-time, specifically to keep the run-history list and
run-detail UI to "one row = one scenario's result" instead of a nested aggregation view.
Running "all scenarios for this template" in one batch is a straightforward fast-follow
(loosen the snapshot fields to an array, add a "run all" action) once the single-scenario flow
is proven.

### Webapp: nested tabs, payload-streaming subscription, one new turn-editor pattern

`AgentTemplateDetail.tsx` becomes the app's first real usage of the existing (currently
unused) `Tabs` component — every other detail page (Campaign, Portfolio, and this one today)
is a stack of `SectionCard`s instead. Tab set is channel-conditional, computed the same way
`syncsWithFonoster`-style branches already read `tmpl.type`: `Escenarios`/`Ejecuciones` for
VOICE_AI/EMAIL/WHATSAPP, a single `Vista previa` for SMS/VOICE_PRERECORDED.

The run-detail/live-stream view needs a new hook, `useEvaluationRunStream` — distinct from the
existing `useContactLogRealtime`, which is signal-only (`onData` just invalidates a query and
refetches). Here the subscription payload _is_ the data:
`trpc.agentEvaluations.evaluate.useSubscription(input, { onData, onError, onComplete })`,
accumulating `EvalEvent`s into local state and rendering turns as they arrive; `onComplete`
invalidates `evaluationRuns.list`/`get` to pick up the server-persisted row rather than saving
anything client-side.

The one genuinely new interaction pattern in the whole feature is the **scenario turn
editor** — an ordered, addable/removable list of `{input, expected}` rows in the create/edit
modal. Nothing like it exists in the app today. Per-turn display (in both the editor and the
run-detail view) is one component with two states — "definition only" vs. "definition +
result" — not two separate components, so pass/fail marks, tool-call detail, and judge
reasoning render the same way whether you're looking at a live run or history.

## Risks / Trade-offs

- **[Risk] A dropped WebSocket mid-run also interrupts the server-side persistence loop** —
  tRPC's WS subscription machinery calls `.return()` on the generator when the client
  disconnects/unsubscribes, same as it already does for the pure-relay case today (the CLI has
  the equivalent limitation if its process is killed mid-run). → **Mitigation**: a `finally`
  block marks the row `INTERRUPTED` with whatever partial `events` were captured, instead of
  leaving it stuck at `RUNNING` forever; the webapp's run-history list treats `INTERRUPTED`
  as a distinct, visibly-incomplete state (not styled as a failure).
- **[Risk] Scope creep back into "design heavy"** (the user's explicit concern) — a
  scenario/run naturally carries a lot of nested data (turns → tool calls → judge reasoning).
  → **Mitigation**: nested tabs (not a new nav section), one scenario per run, reuse of
  existing components (`Accordion` for collapsed detail, `Dialog` for modals, existing
  success/orange/violet/secondary badges) everywhere except the two genuinely new pieces (turn
  editor, `Label/Error` badge). See `tasks.md` for the explicit Pencil frame budget.
- **[Risk] `EvaluationRun.events` (and `Scenario.definition`) are unbounded JSON blobs** — a
  pathological scenario (many turns, verbose tool-call payloads) could produce a large row.
  → **Mitigation**: not addressed in v1 (no observed real-world scenario approaches a size
  that matters); worth a follow-up if operators start authoring very large scenarios.
- **[Risk] Moving `evalReport.ts` changes `mods/ctl`'s import path** — a mechanical but
  real cross-package change. → **Mitigation**: `evalReport.test.ts` moves with the module and
  must stay green unmodified in behavior; `ctl`'s one call site gets a one-line import update.

## Migration Plan

1. Prisma migration adding `Scenario`/`EvaluationRun`/`RunStatus`/`RunVerdict` — additive only,
   no existing table touched, safe to deploy ahead of the API/UI that uses it.
2. Move `evalReport.ts` into `@qcobro/common/reporting`; update `ctl`'s import; ship
   independently of the schema migration (pure refactor, covered by its existing test).
3. `scenarios` router + run-persistence wrapper + `evaluationRuns.report` procedure.
4. Webapp tabs/components, wired last against the now-live API surface.

No rollback complexity beyond normal migration-down for the additive tables; nothing in this
change touches existing data or existing procedures' behavior for non-console callers (the CLI
and SDK continue to work exactly as before — the persistence wrapper is additive to what the
subscription already streams, not a change to its event shape).

## Open Questions

- Whether to archive `openspec/changes/agent-evaluations/` before this change reaches Sync, so
  `agent-evaluations` exists as a real capability in `openspec/specs/` for a future delta
  (this change currently declares no delta against it, since none exists yet to diff). Left
  for explicit user decision — it's a separate, low-risk cleanup, not bundled into this
  change's own diff.
- Whether `EvaluationRun` history needs any retention/cleanup policy once real usage volume is
  known (not a concern at expected v1 scale).
