## Why

The Panel de control's contactability KPI ("Tasa de contacto") can read 100% on a workspace
where nothing was ever actually reached. It counts an account as contacted the moment an
outreach attempt is _dispatched_, not when the channel confirms it worked.

`portfolios.contactStats` counts `PortfolioAccount` rows with `lastContactedAt IS NOT NULL`,
and `reserveAttemptTx` sets `lastContactedAt` at attempt-**reservation** time — before the
provider call, by design, because reservation is the engine's at-most-once step. So an SMS to
a dead number, a call that rang out, and a wrong number all count toward the numerator
exactly like a conversation that ended in a payment promise. Issue #95.

The real per-channel result already exists on the gestión: the SMS and voice status-callback
work (#91/#92/#93) finalizes `AccountContactLog.outcome` to `DELIVERED`, `NOT_DELIVERED`,
`NO_ANSWER`, `WRONG_NUMBER`, or a downstream engagement outcome. `contactStats` simply never
looks at it.

Fixing the KPI exposes the reason it was never fixable: `OTHER`. It is written at dispatch as
"no result yet", returned by the autopilots when they escalate, and used as the catch-all
when a model answer doesn't parse. It therefore asserts nothing — not that the channel
worked, not that it failed, not that anything is known at all — while occupying the one field
that is supposed to say what happened. No contactability rule can be written over it.

## What Changes

- **`OTHER` is removed from `ContactOutcome` entirely.** Every value in the enum should be a
  claim about what happened; `OTHER` never was one.
- **A new `DISPATCHED` outcome** is the dispatch-time placeholder on every channel, Voice AI
  included: the attempt left QCobro and nothing has reported back yet. It names the state
  honestly instead of disguising "unknown" as a result.
- **Outcomes are set by whichever layer actually knows something**, and only move up:
  1. **dispatch** writes `DISPATCHED`;
  2. the **channel layer** — Twilio's status callback, Fonoster's CDR, the VoiceServer's
     completion, or an inbound reply on email/WhatsApp — resolves it to `DELIVERED`,
     `NOT_DELIVERED`, `NO_ANSWER` or `WRONG_NUMBER`;
  3. the **conversation layer** (autopilot) may upgrade it further to `PAYMENT_PROMISE`,
     `DISPUTE_RAISED`, `CALLBACK_REQUESTED`, and the rest.
     When the autopilot cannot classify a conversation — it escalates, or returns an answer
     that doesn't parse — it now writes **no outcome at all** and the channel layer's verdict
     stands. That is what `OTHER` was papering over.
- **An inbound reply finalizes a `DISPATCHED` gestión to `DELIVERED`.** Receiving a message
  back is proof of delivery, and email/WhatsApp have no CDR to fall back on. Without this,
  deleting `OTHER` would strand replied-to threads at `DISPATCHED` and _undercount_ contact.
- **`DISPATCHED` is specified as transitional.** A gestión SHALL NOT be left there
  indefinitely, and until a layer resolves it the attempt counts as _unresolved_ — never as a
  successful contact — in any metric.
- **Contactability is defined and fixed.** An account is contactable when at least one of its
  gestións carries an outcome that proves the channel reached the destination — that is, any
  outcome _other than_ `DISPATCHED`, `NOT_DELIVERED`, `NO_ANSWER`, `WRONG_NUMBER`. Stated as
  an exclusion, not as `outcome === "DELIVERED"`, because a `PAYMENT_PROMISE` or
  `CALLBACK_REQUESTED` can only happen if the channel already worked.
- **`contactStats` reads the gestión log**, not `lastContactedAt`. `lastContactedAt` keeps its
  specified meaning — "timestamp of the most recent outreach attempt" — and its write path is
  untouched, so attempt counting and the daily cap are unaffected.

Out of scope, filed as a follow-up: a sweeper that force-finalizes a gestión stuck at
`DISPATCHED` past a bounded window. Today the SMS path only finalizes when
`twilio.webhookBaseUrl` is configured, so such rows can persist. This change makes them
visible and makes them count correctly (as not-contacted); it does not add the job.

## Capabilities

### Modified Capabilities

- `account-contact-log`: `ContactOutcome` loses `OTHER` and gains `DISPATCHED`. The layered
  rule for who may set an outcome — and the monotonic rule that an outcome never moves
  down — is specified. An inbound reply finalizes delivery. A new requirement states the
  transitional contract for `DISPATCHED`.
- `portfolios`: A contactability statistic is specified — its numerator, its denominator, and
  the outcome set that proves the channel worked.
- `web-console`: The Panel de control's "Tasa de contacto" KPI is specified against that
  statistic; the Gestiones outcome filter drops "Otro" and offers `DISPATCHED`.

## Impact

- **`mods/common`**: `contactOutcomeSchema` drops `OTHER`, gains `DISPATCHED`, and exports
  the channel-failure set plus the outcome ranking used by the no-downgrade rule.
- **`mods/apiserver`**:
  - Prisma `ContactOutcome` changes shape. Postgres has no `DROP VALUE`, so this is **one**
    migration that recreates the type and remaps in the `USING` clause — no `ADD VALUE`, no
    two-step dance.
  - **Backfill: every existing `OTHER` row becomes `DISPATCHED`.** The migration cannot tell
    an old placeholder from an old escalation, and does not need to: today _every_ code path
    treats `OTHER` as "not yet finalized", so this preserves the behavior each of them
    already has, and it is the safe direction for a KPI whose defect is over-counting.
  - Placeholder writers, finalization guards, and autopilot fallbacks all change (see
    tasks.md).
  - `contactStats` switches to a relation filter over `AccountContactLog`.
- **`mods/webapp`**: the Gestiones outcome filter swaps "Otro" for `DISPATCHED`, with en + es
  labels reading as a pending state.
- **Breaking, deliberately**: `OTHER` is a valid value on the public external contact-log
  ingress (`docs-site/api/contact-log.mdx:53`) and on the SDK's derived types. Callers
  sending it will be rejected. It never carried information, and the release notes should say
  so.
- **Visible behavior change**: the contactability KPI drops — on a workspace whose attempts
  all failed or are still in flight, from 100% to 0%. That is the correction, not a
  regression. Historical `OTHER` rows land at `DISPATCHED` and count as unresolved.
- **`lastContactedAt` is unchanged** in meaning, write path, and API shape.
