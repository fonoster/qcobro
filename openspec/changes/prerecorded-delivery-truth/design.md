## Context

`recordPrerecordedOutcome` maps outcome to `entrega` from a single boolean:

```ts
const reportedEntrega: Entrega = input.answered ? "DELIVERED" : "FAILED";
```

`answered` comes from `voiceServer.ts`, where the embedded VoiceServer handler only runs on
pickup, so it is reported as `true` unconditionally. That was sound while the only two outcomes
were "answered and played" and "never answered".

Fonoster #879 and #880 add a third. Verbs now reject when the session ends or errors mid-call
instead of hanging forever, so `runPrerecordedCall`'s catch — which has never executed in
production — starts firing. It returns the real elapsed `answeredSeconds` with no
`camino`/`resultado`, and `answered: true`. Every such call therefore finalizes `DELIVERED`.

From the 2026-08-30 incident, that means a 0.6s network false-answer that played nothing, and a
call stranded in 110 seconds of silence, both report as delivered — the latter as the longest
"successful" contact of the day. The distinction the mapping needs already exists inside
`runPrerecordedCall` (did the verb chain complete, or did it throw); it is simply discarded
before reaching the schema.

## Goals / Non-Goals

**Goals:**

- `entrega: DELIVERED` for a pre-recorded call means QCobro played the message out in full.
- An answered call whose script did not play finalizes `FAILED` / `UNREACHABLE`, and stays
  eligible for retry.
- Reconcile `camino` between spec and code: a completed script is engagement.
- Keep the honest duration on failures — time on the line is real even when nothing was heard.

**Non-Goals:**

- Detecting _partial_ playback. The Say verb either completes or rejects with unknown progress.
- Changing VOICE_AI, SMS, email or WhatsApp classification.
- Changing billing. Settlement continues to use the answered duration regardless of `entrega`;
  the carrier bills for connected time whether or not our audio played.
- Backfilling historical rows.

## Decisions

**1. Carry script completion explicitly rather than inferring it from `camino`.**

`camino: "ENGAGED"` is present exactly when the script completed, so the mapping could read it.
Rejected: it couples a delivery decision to a reporting axis that exists for cross-channel
comparison, and would silently break if `camino` ever gained another source. `entrega` should
depend on a field that means what it is being asked. Add a dedicated boolean to
`prerecordedCompletionSchema` — `scriptCompleted` — and map from it.

_Alternative considered:_ infer from `answeredSeconds >= scriptDurationSeconds`. Rejected as
unreliable; a caller who stays on the line after a failed verb would look successful.

**2. `answered` stays, and stays `true`.**

It still records the honest fact that the callee picked up, and it still drives
`durationSeconds`. Only the `entrega` mapping changes, from `answered` to
`answered && scriptCompleted`. Keeping both fields means a failed-playback call remains
distinguishable from a never-answered one in `channelData`, and the sweep path
(`answered: false`) needs no change.

**3. `UNREACHABLE`, not a new `deliveryReason`.**

The enum already carries it, it is documented as transient, and the semantics fit: we could not
reach the account holder with the message. A new value (`NO_PLAYBACK`) would be more precise but
forces a Prisma enum migration and a new i18n key for marginal gain. Revisit if operators cannot
tell these apart from genuine unreachability in practice.

**4. The `voiceCompletionTimeoutSweep` is unchanged.**

It already reports `answered: false`, which maps to `FAILED` / `PROVIDER_ERROR` under both the
old and new rules. With verbs now rejecting promptly the sweep should fire far less often; it
remains the backstop for a completion that never arrives at all.

## Risks / Trade-offs

- **Reported delivery rates fall on deploy.** → Expected and correct. Call it out in the release
  note so it is not read as a regression, and be ready with the "answered but nothing played"
  count to explain the delta.
- **A partially-played script is reported as `FAILED`.** → Under-claims rather than over-claims,
  which is the safer direction for a collections record. Tracked in Open Questions.
- **More retries.** `UNREACHABLE` is transient, so accounts that previously terminated as
  delivered now stay in the funnel and consume attempts. → Bounded by the existing
  `maxAttemptsPerAccount`; watch attempt volume after deploy.
- **Ships before the Fonoster fixes are deployed.** → Inert but harmless: without #879/#880 the
  catch path is unreachable, so `scriptCompleted` is always `true` and behavior is unchanged.
  Ordering is therefore safe in either direction.
- **`DELIVERED` still cannot prove a human listened.** → Unchanged from today and stated
  explicitly in the spec; the claim is only that we played it.

## Migration Plan

1. Ship the schema field and the mapping together; they are one commit's worth of contract change.
2. Deploy after Fonoster #879/#880 are live, so the new classification has real signal to act on.
3. No data migration. Historical rows keep their recorded `entrega`; the change is
   forward-looking only.
4. Rollback is a revert — no persisted state depends on the new field beyond `channelData`, which
   is additive.

## Open Questions

- **Partial playback.** A caller who hangs up 3s into a 5.7s message currently finalizes
  `FAILED`/`UNREACHABLE`, identical to one who heard nothing. `prerecordedCompletionSchema`
  already carries `scriptDurationSeconds` alongside `answeredSeconds`, so a later refinement
  could treat "played most of it" as delivered. Needs a product decision on the threshold, and
  ideally evidence of how often it happens.
- **Do operators need to distinguish "answered but silent" from "never reachable"?** Both are
  `UNREACHABLE` under this change. If the worklist treats them differently, that argues for the
  dedicated `deliveryReason` rejected in Decision 3.
