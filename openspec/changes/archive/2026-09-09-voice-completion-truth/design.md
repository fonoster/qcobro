> Retroactive record — see `proposal.md`. Written after PR #151 merged, from its description and
> the ten commits it merged. Decisions below are what was actually decided during that PR's
> review, not a forward design.

## Context

`voiceCompletionTimeoutSweep` finalized every stale voice gestión as `FAILED`/`PROVIDER_ERROR`
after a single timeout. `NO_ANSWER` and `BUSY` had been unreachable in code since #126 removed
the CDR resolver — the timeout sweep was the only path that ever closed out an unanswered call,
and it always wrote the same reason regardless of what actually happened. The 2026-08-30 incident
made this visible: 13 of 16 rows in a batch reported `Fallido · Error del proveedor` when roughly
8 of those phones were physically answered.

## Goals / Non-Goals

**Goals**

- Classify every voice failure from Fonoster's own call detail record instead of guessing after a
  fixed timeout.
- Make `NO_ANSWER`, `BUSY`, `REJECTED`, `INVALID_DESTINATION`, and `UNREACHABLE` reachable again.
- Never let the sweep race and discard a real, in-flight completion signal.
- Cover manual/ad-hoc voice dispatch, not just campaign-engine dispatch.
- Reject a public REST payload shaped for the field names this rename retires, rather than
  silently stripping it.

**Non-Goals**

- Not moving to Fonoster's live dial-progress stream (`Calls.TrackCall`) — issue #883 shows it
  never delivers events for API-originated calls today; the CDR poll is what's reachable now.
  Fixing #883 upstream would let this same mapping run in real time instead of on a sweep
  interval, without changing the mapping itself.
- Not adding alias support for the old `entrega`/`camino`/`resultado` field names on the REST
  endpoint. The docs already carried the breaking-change notice, and an alias would keep the old
  shape alive indefinitely.

## Decisions

### The sweep classifies from the CDR, branching on five states

For each voice gestión still at `DISPATCHED` past `floorMinutes` (default 2), the sweep looks up
the call's CDR (`Calls.getCall`) and branches:

| CDR state                                                | Action                                                                                                           |
| :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| Terminal status, ended ≥ `graceSeconds` ago (default 60) | Finalize `FAILED` with the mapped `deliveryReason`                                                               |
| Terminal status, ended < `graceSeconds` ago              | Leave at `DISPATCHED` — the live completion signal may still be in flight                                        |
| No status yet (call in progress)                         | Leave at `DISPATCHED`                                                                                            |
| No CDR at all, < `notOriginatedMinutes` (default 5)      | Leave at `DISPATCHED` — the CDR's start record can lag dispatch                                                  |
| No CDR at all, ≥ `notOriginatedMinutes`                  | Finalize `FAILED`/`NOT_ORIGINATED`                                                                               |
| Still no status past `backstopMinutes` (default 70)      | Finalize `FAILED`/`OUTCOME_UNKNOWN`, or the mapped reason if the CDR is terminal but its end time is unparseable |

The sweep never writes `DELIVERED` — every path it finalizes is a failure to observe an answer,
never a confirmed one — and never writes the CDR's own duration (which includes ring time) into
`durationSeconds`, which stays the channel's own live-signal answered duration.

### Three defects were found and fixed during review, not shipped broken

1. **The sweep could beat a live completion signal and permanently discard it.** A terminal CDR
   only means the call ended, not that QCobro's own completion signal has landed — both fire off
   the same underlying event (Routr's call-end vs. Fonoster's autopilot webhook), and race. A
   sweep pass landing in that window would win the DB-guarded write and record a successful
   conversation as `FAILED`. Fixed with `graceSeconds`, measured from the CDR's own end time —
   this is why the grace/no-status branches above are identical: neither finalizes.
2. **`parseEndedAt` would have nulled every real CDR.** `@fonoster/types` declares
   `endedAt: Date`, but the wire field is `int32 ended_at` — epoch seconds — and nothing in the
   SDK converts it. The original parser only accepted `Date`, so the terminal-with-grace branch
   would never have fired in production and the whole feature would have silently degraded to
   `NOT_ORIGINATED`-or-`OUTCOME_UNKNOWN`-only. Fixed: `parseEndedAt` accepts a `Date`, a number
   (disambiguating epoch seconds from milliseconds by magnitude), or a numeric string, and warns
   once instead of failing quietly on an unparseable value.
3. **A terminal CDR with an unparseable end time stalled forever.** The grace check returned
   early and skipped the backstop entirely, so a gestión in that state was re-polled every pass
   with no exit. Fixed: it now falls through to the backstop and finalizes with the CDR's mapped
   reason (not the generic `OUTCOME_UNKNOWN` — the CDR does say how the call cleared, even
   without a trustworthy timestamp for it).

`backstopMinutes` defaults to 70, not a round number: the platform's dialplan sets
`TIMEOUT(absolute)=3600`, so no channel survives past 60 minutes — past that plus a margin, an
uncleared CDR has genuinely lost its end record rather than still belonging to a live call.

### The sweep moved off the campaigns-engine tick, with its own lease

The sweep previously ran inside the engine's runner, after the engine acquired its shared lease —
so exactly one instance ever swept, but only while the engine was running. Manual/ad-hoc voice
dispatch has no engine tick, so it was never covered. Moving the sweep to its own
`startVoiceCompletionSweep` interval lost that single-leader guarantee: a bare `setInterval` only
guards against re-entry within one process, so on a multi-replica deployment every replica would
run a full pass concurrently. Fixed by parameterizing `createEngineLease`'s lease row id
(defaulting to `"engine"`, unchanged for existing callers) so the sweep claims its own
`"voice-completion-sweep"` row instead of contending with the campaigns engine's lease. The DB-
guarded gestión update keeps `delivery`/`outcome` correct either way; the lease is about RPC
amplification (up to `batchSize` sequential `Calls.getCall` calls per replica per pass) and
duplicate billing settlement, not data correctness. `settleVoiceUsageTx` was confirmed idempotent
per `providerRef` independently of this fix (checks `settledAt`; a `(usageRecordId, kind)` unique
constraint guards a racing double-insert).

### The public REST endpoint's schema became strict

`createContactLogSchema` was a plain Zod object, so `POST /api/contact-logs` silently stripped
any key it didn't recognize. Immediately after the axes rename, that meant a caller still posting
the pre-rename Spanish field names — the exact shape the docs described until the last few
commits of this PR — got a `201` and a row written `DISPATCHED` with no outcome: silent data
loss on the one write path a caller outside this codebase reaches directly.
`createContactLogSchemaStrict` (`createContactLogFields.strict()`, same axis validation) is used
only by the REST handler; tRPC/operator-console callers stay on the lenient schema, since they're
TypeScript-typed against `CreateContactLogInput` already and a stray key there is a compile
error, not a runtime concern. No alias for the old names was added.

## Risks / Trade-offs

- **Not verified against a live call before merge.** The PR description flags this explicitly:
  two of the three review-found defects came from reasoning about Fonoster's wire format rather
  than observing it, so `endedAt`'s runtime type and `GetCall`'s live behavior against a real
  deployment were called out as worth confirming with one real dispatched call before this
  reaches production. This retroactive record does not independently confirm whether that
  live-call verification happened after merge.
- **Resolution latency is bounded by the sweep interval and thresholds, not instantaneous** for
  most terminal cases — this is unchanged from the sweep design in general and was an accepted
  trade-off in this PR too. Upstream issue #883 is the path to a real-time signal.
- **Follow-ups filed but deliberately not in this PR**: the pre-recorded detail view still plays
  a TTS re-synthesis of the script instead of the already-resolved call recording; the `outcome`
  filter offers ten values when only three are ever produced (the autopilot prompts name no
  others); `channelData.scriptDurationSeconds` and `correctedEntryId` remain defined and never
  written.
