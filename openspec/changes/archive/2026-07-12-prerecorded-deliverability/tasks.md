## 1. Shared contracts (@qcobro/common)

- [x] 1.1 `scriptDurationSeconds` carried on the completion contract + written to voice `channelData`
- [x] 1.2 `durationSeconds` populated for `VOICE_PRERECORDED` (answered) / 0 when unanswered
- [x] 1.3 `prerecordedCompletionSchema` (providerRef, answered, answeredSeconds, scriptDurationSeconds?, at)

## 2. Design (Pencil) — human-gated

- [x] 2.1 Pre-recorded Detalle de gestión: outcome ("Entregado") + call duration, replayable script as a distinct element, no "heard" copy
- [x] 2.2 Delivery lifecycle folded into the "Estado de entrega" metadata field as a reached-stage arrow string (unicode →); no stepper component, no duplicate status field, even columns
- [x] 2.3 Email/WhatsApp detail renders the message thread; delivery progression capped at one full cycle (no per-message repeat)
- [x] 2.4 Get explicit sign-off that the design is good before building

## 3. apiserver / VoiceServer — in-process completion & settlement

- [x] 3.1 VoiceServer measures answered duration (answer → hangup) in-process and emits a completion (no HTTP endpoint)
- [x] 3.2 `recordPrerecordedOutcome` writes `outcome` = DELIVERED/NOT_DELIVERED, `durationSeconds`, optional `scriptDurationSeconds`
- [x] 3.3 index wires settlement via the existing `settleVoiceUsage` estimate→settle path
- [x] 3.4 Completion idempotent per call ref (never downgrades a finalized outcome; settlement guards on `settledAt`)
- [ ] 3.5 **OPEN:** unanswered pre-recorded calls — the embedded verb only fires on answer, so NOT_DELIVERED / settle-to-zero for a never-answered call needs a Fonoster call-status signal (see checkpoint)

## 4. Webapp

- [x] 4.1 Delivery-status field renders the reached-stage arrow progression; helper derives stages from outcome + channelData; threaded channels capped at one cycle by construction
- [x] 4.2 Pre-recorded gestión detail: "Guion reproducible" (separated script), duration + Estado de entrega progression; non-"heard" copy
- [x] 4.3 Email/WhatsApp render the message thread (already threaded) and now show the Estado de entrega progression
- [x] 4.4 New strings added to i18n (EN + ES): stage labels, repurposed titles, honest pre-recorded insight copy

## 5. Tests

- [x] 5.1 Unit: answered completion sets DELIVERED + duration (recordPrerecordedOutcome.test.ts)
- [x] 5.2 Unit: unanswered completion sets NOT_DELIVERED with zero duration
- [x] 5.3 Unit: idempotent (finalized outcome preserved) + validation-failure case (structured error, no DB touch)
- [x] 5.4 E2E: `gestiones-channels.spec.ts` updated + **executed green** against the live dev stack — pre-grabada asserts "Guion reproducible", "Enviado → Entregado", honest copy, no "reproducido al cliente", no transcript (1 passed)
- [x] 5.5 Green on touched packages: common build + tests (102), apiserver typecheck + tests (46 incl 5 new), webapp typecheck, eslint

## 6. Spec sync & archive (gated)

- [ ] 6.1 `openspec validate prerecorded-deliverability` passes
- [ ] 6.2 Sync deltas into main specs (gate first)
- [ ] 6.3 Archive the change (gate first)
