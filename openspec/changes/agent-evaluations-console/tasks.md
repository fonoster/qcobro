## 1. Design (Pencil) — tonight's scope

All frames land in the existing `Agentes` (`uOaur`)/`Agentes Modals` (`oZPkT`) clusters in
`pencil.pen`, following the `"<Entity> · <Mode>"` naming convention already in use. No new
cluster.

**Status: structurally built overnight (2026-09-10/11), NOT yet human-reviewed.** Every item
below was built and its node tree verified correct via the Pencil MCP's `Get`/bounds
inspection (positions, sizes, and structure all resolve correctly, no negative/zero
dimensions). However, `TakeScreenshot` was unreliable and inconsistent all session for
freshly-created deep node trees — some frames rendered correctly, others stayed blank across
multiple retries despite verified-correct underlying data, and a few improved after several
unrelated calls "cooked." This looks like a renderer/cache staleness bug in the MCP tool
itself (see `feedback` sent + `reference_pencil_build_workaround.md` memory update), not a
design defect — but it means **this work has not been visually confirmed** the normal way.
**First thing tomorrow: open `pencil.pen` in Pen.app itself (not this MCP tool) and look at
the `uOaur`/`oZPkT` clusters directly** before trusting anything below is visually correct.

- [x] 1.1 New component: `Label/Error` (`j6TZnt`) — a fifth badge variant alongside the
      existing `Label/Success`/`Label/Orange`/`Label/Violet`/`Label/Secondary`, using the
      `$--color-error`/`$--color-error-foreground` tokens already established elsewhere
      (e.g. "Vencida" in Promesas de pago), structurally matching the existing label
      components exactly
- [x] 1.2 New component: turn/step row — `Turn Row/Closed` (`uZ7cA`) and `Turn Row/Open`
      (`LvHM1`), mirroring the existing `Accordion/Closed`/`Accordion/Open` two-component
      convention (no working single-component toggle precedent existed in this file to
      reuse). Pass/fail mark + input/response in the closed trigger row; expected/actual/tool
      calls/judge reasoning in the open state's content
- [x] 1.3 New layout pattern: scenario turn editor — built inline inside the create/edit
      modal (1.8): ordered turn blocks, each with a message textarea, an expected-type
      select, an expected-response field, and a remove action, plus an "Añadir turno" button
- [x] 1.4 Frame `"Agente · Detalle · Escenarios"` (`RrD1d`, in `uOaur`) — scenario list (ref,
      description, verdict badge, row actions), "Nuevo escenario" button
- [x] 1.5 Frame `"Agente · Detalle · Ejecuciones"` (`M21wq`, in `uOaur`) — run history list
      (scenario ref, timestamp, status/verdict badge, view/download row actions)
- [x] 1.6 Frame `"Agente · Detalle · Ejecución"` (`qr1TI`, in `uOaur`) — run detail: pass/fail
      summary header + download-report button, 4 ordered turn rows (3 closed + 1 open showing
      full tool-call/judge-reasoning detail)
- [x] 1.7 Frame `"Agente · Detalle · Vista previa"` (`OZ6rZ`, in `uOaur`, SMS/VOICE_PRERECORDED
      only) — sample-account input form + rendered-output panel, 3-tab bar
      (Configuración/Campañas/Vista previa only — no Escenarios/Ejecuciones)
- [x] 1.8 Frame `"Crear/Editar escenario · Modal"` (`ofDkU`, in `oZPkT`) — ref/description
      fields + the turn editor (1.3, 2 sample turns) + error-inline + Cancel/Save actions,
      mirroring the existing per-channel create modals' Header/Content/Error Inline/Actions
      structure exactly
- [x] 1.9 Tab bar wired onto `"Agente · Detalle"` (`oK2Cr`) and copied into 1.4-1.7.
      **Deviation from plan**: the file's existing `Tabs`/`Tab Item` design-system components
      (`yUASe`/`cwafo`/`DDw41`) turned out to be broken — every instance of them (isolated,
      freshly created, in any parent) rendered blank/failed bounds computation, and a
      document-wide search confirmed they have zero prior usages anywhere in the file, so
      this was never exercised before. Worked around by hand-building an equivalent pill tab
      bar from plain frames/text matching the same visual spec (`$--secondary` pill, active
      item on `$--background` with the same shadow token, inactive items in
      `$--muted-foreground`) — visually identical to what the component would have produced,
      just not using the (broken) shared component. **Flag to the user**: either fix
      `yUASe`/`cwafo`/`DDw41` directly, or intentionally deprecate them in favor of this
      hand-built pattern if they're unrecoverable — worth a decision, not a silent workaround
      to leave buried in a task list.

## 2. Spec reconcile

- [ ] 2.1 Compare finalized Pencil design against this change's delta specs; update
      `specs/agent-evaluations-console/spec.md` / `specs/web-console/spec.md` /
      `design.md`/this file if the design session surfaced new states, fields, or edge cases
- [ ] 2.2 `openspec validate agent-evaluations-console --strict`
- [ ] 2.3 Decide (with the user) whether to archive `openspec/changes/agent-evaluations/`
      before proceeding, per `design.md`'s Open Questions

## 3. Data model (`mods/apiserver`)

- [ ] 3.1 Add `Scenario`, `EvaluationRun`, `RunStatus`, `RunVerdict` to
      `prisma/schema.prisma` (see `design.md`); add `scenarios`/`evaluationRuns` relations to
      `AgentTemplate`
- [ ] 3.2 Generate and apply the migration

## 4. Reporting relocation (`mods/common`, `mods/ctl`)

- [ ] 4.1 Move `mods/ctl/src/evalReport.ts` (+ its test) to
      `mods/common/src/reporting/evalReport.ts`; add a `./reporting` subpath export to
      `mods/common/package.json` alongside the existing root `.` export
- [ ] 4.2 Update `mods/ctl/src/commands/agents/eval.ts`'s import path; confirm
      `evalReport.test.ts` passes unmodified in its new location
- [ ] 4.3 Confirm the webapp's existing `@qcobro/common` (root) imports are unaffected and
      that `pdfmake` does not appear in the webapp bundle

## 5. API (`mods/apiserver`)

- [ ] 5.1 Add a thin `createScenarioSchema`/`updateScenarioSchema` to
      `mods/common/src/schemas/` wrapping the existing `evalScenarioSchema` with an
      `agentTemplateId` pointer
- [ ] 5.2 New `scenarios` router (list/create/update/delete), following
      `whatsAppIntegration.ts`'s router shape and `functions/whatsApp/*WhatsAppSenderNumber.ts`'s
      `create*(client, workspaceRef)` + `withErrorHandlingAndValidation` + ownership-check
      pattern; reject creation against SMS/VOICE_PRERECORDED templates
- [ ] 5.3 Wrap `agentEvaluations.evaluate`'s subscription handler with run persistence
      (`startEvaluationRun`/`finalizeEvaluationRun`, see `design.md`), including the
      `finally`-block `INTERRUPTED` handling for a dropped connection
- [ ] 5.4 New `evaluationRuns` router: `list`/`get` (history + detail) and `report({id,
  format})` reusing `buildReportModel`/`renderHtml`/`renderPdf` from
      `@qcobro/common/reporting`

## 6. Webapp (`mods/webapp`)

- [ ] 6.1 Storybook stories for the new components first: turn/step row (both states),
      scenario turn editor, fail badge
- [ ] 6.2 Wire `Tabs` onto `AgentTemplateDetail.tsx` with the channel-conditional tab set
- [ ] 6.3 Escenarios tab: list (`trpc.scenarios.list`) + create/edit `Dialog` modal (turn
      editor) + `ConfirmDeleteDialog`, mirroring `PortfolioDetail.tsx`'s
      `onClose`/`onSuccess` → `utils.scenarios.invalidate()` convention
- [ ] 6.4 New `useEvaluationRunStream` hook wrapping
      `trpc.agentEvaluations.evaluate.useSubscription` (payload-accumulating, distinct from
      `useContactLogRealtime`'s signal-only pattern)
- [ ] 6.5 Ejecuciones tab: run history list + live/historical run-detail view (turn/step row) + download-report action
- [ ] 6.6 Vista previa tab (SMS/VOICE_PRERECORDED): sample-account form →
      `trpc.agentTemplates.preview.useQuery`
- [ ] 6.7 New i18n keys (`agents.scenarios.*`, `agents.runs.*`, `agents.preview.*`) in both
      `en`/`es` blocks of `mods/webapp/src/lib/i18n.tsx`

## 7. Tests

- [ ] 7.1 Unit: `scenarios` CRUD functions — ownership checks, SMS/VOICE_PRERECORDED
      rejection, a validation-failure case per CLAUDE.md's validated-function convention
- [ ] 7.2 Unit: run-persistence wrapper — RUNNING→COMPLETE/ERROR/INTERRUPTED transitions,
      snapshot fields correct, turn counts match streamed events
- [ ] 7.3 Unit: `evaluationRuns.report` — output matches `buildReportModel` given a stored
      `events` array
- [ ] 7.4 Webapp: component/interaction tests for the turn editor and the live-streaming run
      view
- [ ] 7.5 E2E: golden path — create scenario → run → see pass/fail → download report
- [ ] 7.6 E2E or integration: a dropped-connection run ends up `INTERRUPTED`, not stuck
      `RUNNING`
- [ ] 7.7 `lint`/`typecheck`/`test` green across `mods/apiserver`, `mods/common`, `mods/ctl`,
      `mods/webapp`

## 8. Sync / Archive

- [ ] 8.1 `/opsx:sync` — promote delta specs into `openspec/specs/agent-evaluations-console/`
      and `openspec/specs/web-console/`
- [ ] 8.2 `/opsx:archive agent-evaluations-console`
