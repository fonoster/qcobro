## 1. Contract

- [x] 1.1 Add `scriptCompleted: boolean` to `prerecordedCompletionSchema` in
      `mods/common/src/schemas/voiceEvent.ts`, documenting that it means QCobro played the
      message out in full — not that anyone listened
- [x] 1.2 Update the schema's doc comment so the distinction between `answered` (the callee
      picked up) and `scriptCompleted` (the message played) is explicit for future readers

## 2. Report script completion from the VoiceServer

- [x] 2.1 Have `runPrerecordedCall` in `mods/apiserver/src/voice/voiceServer.ts` return whether
      the verb chain completed — `true` on a clean return from `handlePrerecordedCall`, `false`
      on the catch path
- [x] 2.2 Pass `scriptCompleted` through the `onCompleted` call in `startVoiceServer`, alongside
      the existing `answered`/`answeredSeconds`
- [x] 2.3 Update the `runPrerecordedCall` doc comment, which currently states that an early
      hangup still reports delivery — that is exactly what this change reverses

## 3. Classify the outcome

- [x] 3.1 In `mods/apiserver/src/functions/voice/recordPrerecordedOutcome.ts`, change the
      `entrega` mapping from `input.answered` to `input.answered && input.scriptCompleted`
- [x] 3.2 Default `deliveryReason` to `UNREACHABLE` when the call was answered but the script did
      not play, leaving the existing `NO_ANSWER`/`PROVIDER_ERROR` paths untouched
- [x] 3.3 Keep `durationSeconds` as the real answered duration on the failed-playback path — the
      time on the line is real even when nothing was heard
- [x] 3.4 Confirm `voiceCompletionTimeoutSweep` still compiles and behaves unchanged, since it
      reports `answered: false` and never sets `scriptCompleted`

## 4. Tests

- [x] 4.1 `recordPrerecordedOutcome.test.ts`: answered + script completed → `DELIVERED`, real
      duration, `camino: ENGAGED`
- [x] 4.2 `recordPrerecordedOutcome.test.ts`: answered + script NOT completed → `FAILED` /
      `UNREACHABLE`, real duration preserved, `camino`/`resultado` null
- [x] 4.3 `recordPrerecordedOutcome.test.ts`: unanswered → `FAILED` / `NO_ANSWER` unchanged
- [x] 4.4 `recordPrerecordedOutcome.test.ts`: idempotence still holds — a second completion does
      not advance `entrega` or overwrite `camino`/`resultado`
- [x] 4.5 `voiceServer.test.ts`: a clean run reports `scriptCompleted: true`; a verb that throws
      mid-chain reports `scriptCompleted: false` with the real elapsed duration
- [x] 4.6 Verify the two incident shapes end to end: a ~0.6s answer that played nothing, and a
      call stranded in silence for 110s, both finalize `FAILED`/`UNREACHABLE` rather than
      `DELIVERED`

## 5. Verify the console needs no change

- [x] 5.1 Confirm `Fallido · Inalcanzable` renders correctly through `entregaLabel` in
      `mods/webapp/src/lib/contactAxes.ts` with the existing i18n keys
- [x] 5.2 Confirm no hardcoded assumption that a voice gestión with a non-zero
      `durationSeconds` is `DELIVERED`

## 6. Sync and release

- [x] 6.1 Run `/opsx:sync` to fold the delta into `openspec/specs/prerecorded-audio/spec.md`
- [ ] 6.2 Note in the release description that pre-recorded `DELIVERED` counts will fall, with
      the "answered but nothing played" count as the explanation — this is a correction, not a
      regression
- [ ] 6.3 Watch attempt volume after deploy: `UNREACHABLE` is transient, so accounts that used to
      terminate as delivered now stay in the funnel
