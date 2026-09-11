## 1. Design (Pencil) — tonight's scope

All frames land in the existing `Agentes` (`uOaur`)/`Agentes Modals` (`oZPkT`) clusters in
`pencil.pen`, following the `"<Entity> · <Mode>"` naming convention already in use. No new
cluster.

- [ ] 1.1 New component: `Label/Error` — a fifth badge variant alongside the existing
      `Label/Success`/`Label/Orange`/`Label/Violet`/`Label/Secondary`, using the
      `$--color-error`/`$--color-error-foreground` tokens already established elsewhere
      (e.g. "Vencida" in Promesas de pago), structurally matching the existing label
      components exactly
- [ ] 1.2 New component: turn/step row — pass/fail mark + input/response + expandable detail
      (tool calls, judge reasoning) via the existing `Accordion` (`3ikiO`/`bKYtw`, reused
      as-is). Two states of one component: "definition only" (scenario editor) and
      "definition + result" (run detail) — not two components
- [ ] 1.3 New layout pattern: scenario turn editor — an ordered, addable/removable list of
      `{input, expected}` rows, used inside the create/edit-scenario modal
- [ ] 1.4 Frame `"Agente · Detalle · Escenarios"` (in `uOaur`) — scenario list (ref,
      description, turn count, last-run verdict badge), row actions, empty state
- [ ] 1.5 Frame `"Agente · Detalle · Ejecuciones"` (in `uOaur`) — run history list (timestamp,
      scenario ref, verdict/status badge, view/download row actions), empty state
- [ ] 1.6 Frame `"Agente · Detalle · Ejecución"` (in `uOaur`) — run detail: pass/fail header,
      ordered turn rows (1.2), an in-progress/live-streaming visual state (one frame serves
      both the live view and the historical view)
- [ ] 1.7 Frame `"Agente · Detalle · Vista previa"` (in `uOaur`, SMS/VOICE_PRERECORDED only) —
      sample-account input form + rendered-output panel. Lowest priority/risk frame — cut
      first if time is short
- [ ] 1.8 Frame `"Crear/Editar escenario · Modal"` (in `oZPkT`) — houses the turn editor (1.3),
      mirrors how per-channel create modals are already co-located in this cluster
- [ ] 1.9 Wire the new `Tabs` component (existing, currently unused anywhere in the file) onto
      `"Agente · Detalle"` (`oK2Cr`): `Configuración`/`Campañas` (unchanged) plus
      `Escenarios`/`Ejecuciones` for VOICE_AI/EMAIL/WHATSAPP, or `Vista previa` alone for
      SMS/VOICE_PRERECORDED

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
