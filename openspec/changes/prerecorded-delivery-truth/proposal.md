## Why

A pre-recorded gestión currently reports `DELIVERED` whenever the call was answered, whether or
not the message ever played. That was a safe simplification while a failed verb could only hang,
but Fonoster PRs #879 and #880 now make a lost or failed verb reject — so
`runPrerecordedCall`'s catch becomes reachable for the first time, and calls that played nothing
start finalizing as delivered.

Two real calls from the 2026-08-30 incident show the cost. A network false-answer hung up 0.6s
after answering having played nothing, and a call whose Answer verb was dropped left the
recipient holding **110 seconds of silence**. Under today's rule both report `DELIVERED` — and
the second reads to an operator as the best contact of the day. Today they are wrongly `FAILED`;
after the Fonoster fix deploys they become wrongly `DELIVERED`, which is worse, and no test
catches it because both are spec-conformant.

## What Changes

- **BREAKING (reporting semantics):** `entrega` for a pre-recorded call becomes `DELIVERED` only
  when the call was answered **and** the script played to completion. Answered but provably
  nothing played finalizes `FAILED` with `deliveryReason: UNREACHABLE`.
  - `UNREACHABLE` is transient, so the account stays eligible for retry — correct, since the
    account holder never received the message.
  - Operators comparing periods across the deploy will see pre-recorded `DELIVERED` counts fall.
    This is a correction, not a regression.
- The existing guarantee is preserved and sharpened: `DELIVERED` still never asserts that a human
  **listened**. It now asserts only that QCobro **played the message out** — which is the part
  the platform can actually know.
- **Spec/code reconciliation on `camino`:** the spec says `camino` stays null unless a DTMF digit
  was pressed, but `voiceServer.ts:149` has always set `ENGAGED` on any completed script. Product
  decision: listening to the end and pressing a digit both indicate engagement, so the code is
  right and the spec is wrong. `camino` is `ENGAGED` when the script played to the end **or** a
  configured digit was pressed. `resultado: OPT_OUT` stays gated on the opt-out digit
  specifically.

Explicitly **not** in scope: partially-played scripts. A caller who hangs up 3s into a 5.7s
message has no signal today — the Say verb either completes or rejects with unknown progress, so
a partial play is indistinguishable from none and finalizes `FAILED`/`UNREACHABLE` under this
change. `prerecordedCompletionSchema` already carries `scriptDurationSeconds` alongside
`answeredSeconds`, which a later refinement can compare. Recorded as an open question in
design.md.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prerecorded-audio`: the requirement "Pre-recorded call completion is recorded in-process"
  changes on two points — the `entrega` mapping now depends on script completion rather than
  answer alone, and the `camino` rule now recognises a completed script as engagement.

## Impact

- **Specs:** `openspec/specs/prerecorded-audio/spec.md` — one requirement, two bullets plus the
  closing `DELIVERED` sentence and the affected scenarios.
- **Contracts:** `@qcobro/common` `prerecordedCompletionSchema` gains a signal for whether the
  script completed; today `answered: boolean` cannot express it.
- **apiserver:** `voice/voiceServer.ts` (`runPrerecordedCall` must report completion, not just
  elapsed time) and `functions/voice/recordPrerecordedOutcome.ts` (the `entrega` mapping at
  line 119).
- **Web console:** no code change expected — `entrega`/`deliveryReason` already render through
  `contactAxes.ts` and the existing `gestiones.entrega.*` i18n keys, including
  `Fallido · <reason>`.
- **Reporting:** pre-recorded `DELIVERED` counts drop; `FAILED`/`UNREACHABLE` rises. Contact-rate
  and recovery metrics derived from `entrega` shift accordingly.
- **Not affected:** VOICE_AI (`recordVoiceAiCallStatus`), SMS, email and WhatsApp classification
  are untouched.
- **Depends on:** Fonoster #879 and #880 being deployed. Before then the catch path is
  unreachable and this change is inert; it should ship close behind them, not long after.
