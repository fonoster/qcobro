# Design — contactability KPI

## Decision 1: delete `OTHER`, add `DISPATCHED`

`OTHER` is written in three unrelated situations:

| where                                                                                 | what it actually meant            |
| ------------------------------------------------------------------------------------- | --------------------------------- |
| `engine.ts:530`, `outreach.ts:283`, `followUpPaymentPromise.ts:44`                    | "dispatched, no result yet"       |
| `voiceAutopilot.ts:83`, `emailAutopilot.ts:68`, `whatsAppAutopilot.ts:67`             | "escalated — a human decides"     |
| `decideVoiceOutcome.ts:89`, `ingestEmailReply.ts:166`, `ingestWhatsAppMessage.ts:172` | "the model's answer didn't parse" |

None of those is a claim about what happened to the debtor, which is what the `outcome`
column exists to record. The first is QCobro's own state and gets its own value,
`DISPATCHED`. The other two are _absences_ of a classification — and an absence should not be
written into the field at all.

So `OTHER` is removed from the enum rather than redefined. Nothing needs a catch-all: the
enum already spans the real results (`DISPUTE_RAISED` covers the escalation the prompts
actually describe — "reclamo, disputa, amenaza legal"), and anything the autopilot cannot
place leaves the outcome alone.

**Alternative considered — keep `OTHER` as a terminal "channel worked, unclassified".** It
would have been a smaller diff, and an escalated conversation would count as contact
immediately. Rejected: it re-creates the ambiguity one layer down (an operator reading
"Otro" still learns nothing), and the layered model below produces the same contactability
answer through the channel's own evidence, which is stronger than a guess.

## Decision 2: three layers, and outcomes only move up

```
DISPATCHED ──▶ channel layer ──▶ conversation layer
   rank 0      DELIVERED             PAYMENT_PROMISE
               NOT_DELIVERED         PARTIAL_PAYMENT_AGREED
               NO_ANSWER             NEW_TERMS · CALLBACK_REQUESTED
               WRONG_NUMBER          DISPUTE_RAISED · INFORMATION_REQUEST
                 rank 1              RESOLVED · PAID · OPT_OUT · REFUSED
                                             rank 2
```

- **Dispatch** writes `DISPATCHED` on every channel, Voice AI included.
- **The channel layer** says whether the transport worked: Twilio's status callback,
  Fonoster's CDR, the VoiceServer's in-process completion — or, on email and WhatsApp, an
  inbound reply (Decision 3).
- **The conversation layer** — the autopilots — may upgrade further. When it cannot classify
  (`escalate`, or an answer outside `VALID_OUTCOMES`) it writes **no outcome**, and whatever
  the channel layer determined stands. `decideVoiceOutcome` already has this path:
  `if (!decision.outcome) return { decided: true, outcome: null }`.

`escalate` is safe to strip the outcome from: nothing downstream reads it as a result. The
action's only effect is suppressing an auto-reply (`ingestEmailReply.ts:123`,
`ingestWhatsAppMessage.ts:136`, `runAutopilotEvaluation.ts:54`).

The no-downgrade rule becomes the ranking above, replacing the `OTHER`-shaped special case in
`recordOutcomeTx`:

```ts
// keep the recorded outcome when the incoming one knows strictly less
const effective = RANK[params.outcome] < RANK[existing.outcome] ? existing.outcome : params.outcome;
```

| existing          | incoming          | result            | why                                  |
| ----------------- | ----------------- | ----------------- | ------------------------------------ |
| `DISPATCHED`      | `DELIVERED`       | `DELIVERED`       | channel finalizes the placeholder    |
| `DISPATCHED`      | `PAYMENT_PROMISE` | `PAYMENT_PROMISE` | conversation resolved before the CDR |
| `DELIVERED`       | `PAYMENT_PROMISE` | `PAYMENT_PROMISE` | conversation upgrades the channel    |
| `PAYMENT_PROMISE` | `DELIVERED`       | `PAYMENT_PROMISE` | no downgrade — the spec'd guarantee  |
| `PAYMENT_PROMISE` | `DISPATCHED`      | `PAYMENT_PROMISE` | no downgrade                         |
| `PAYMENT_PROMISE` | `DISPUTE_RAISED`  | `DISPUTE_RAISED`  | equal rank — the thread moved on     |

This is strictly stronger than today's guard, which only protected against an incoming
`OTHER` and would happily let a late `DELIVERED` overwrite a recorded `PAYMENT_PROMISE`.

The narrower guards in `recordSmsDeliveryStatus`, `recordVoiceAiCallStatus`,
`recordPrerecordedOutcome` and `resolveVoiceCallFromCdr` ask a different question — "is this
row still awaiting its channel callback?" — and become `=== "DISPATCHED"`, which keeps them
idempotent per gestión.

## Decision 3: an inbound reply is proof of delivery

Voice gets a channel verdict for free: the CDR resolves a `DISPATCHED` call to `DELIVERED` or
`NO_ANSWER` even when the autopilot declines to classify. Email and WhatsApp have no such
fallback — so once the autopilot stops writing `OTHER`, a thread where the debtor actually
replied would sit at `DISPATCHED` forever and count as _not contacted_. That would trade an
over-count for an under-count.

The fix is a fact the ingress already has in hand: it is running _because_ a reply arrived.
`ingestEmailReply` and `ingestWhatsAppMessage` therefore finalize a gestión still at
`DISPATCHED` to `DELIVERED` before applying any autopilot decision. If the autopilot then
classifies, the ranking promotes it further; if it escalates, `DELIVERED` stands and the
account correctly counts as contacted.

## Decision 4: contactability is an exclusion, on the read path

Numerator and denominator:

- **denominator** — active (`archivedAt: null`) accounts in the workspace's non-archived
  portfolios. Unchanged from today.
- **numerator** — those with at least one gestión whose outcome is **not** in
  `{ DISPATCHED, NOT_DELIVERED, NO_ANSWER, WRONG_NUMBER }`.

Stated as an exclusion because inclusion cannot be enumerated safely: every engagement
outcome implies the channel worked, and any outcome added later will too. An exclusion list
fails safe — a new outcome counts as contact only if someone deliberately adds it to the
failure set.

Expressed as one Prisma relation filter, so it stays a single query:

```ts
ctx.prisma.portfolioAccount.count({
  where: { ...base, contactLogs: { some: { outcome: { notIn: CHANNEL_FAILED_OUTCOMES } } } }
});
```

**Alternative considered — a `lastConnectedAt` column** written when an outcome proves the
channel worked. Rejected: it costs a schema migration and a write-path spec change, it reads
0% for all existing data until new traffic lands, and it duplicates a fact the gestión log
already holds. The read-path filter is derived from the source of truth and is correct for
historical rows immediately.

`lastContactedAt` is deliberately left alone. `portfolio-accounts/spec.md` defines it as
"timestamp of the most recent outreach attempt", the engine's attempt counting depends on
that meaning, and it is exposed on the SDK's account shape.

## Decision 5: one migration, remapping in the `USING` clause

Postgres has no `ALTER TYPE … DROP VALUE`, so removing `OTHER` means recreating the type.
That is convenient: the same statement can add `DISPATCHED` and remap the old rows, avoiding
the "cannot use a new enum value in the transaction that added it" restriction entirely.

```sql
ALTER TYPE "ContactOutcome" RENAME TO "ContactOutcome_old";
CREATE TYPE "ContactOutcome" AS ENUM ('DISPATCHED', 'DELIVERED', …, 'REFUSED');
ALTER TABLE "account_contact_logs"
  ALTER COLUMN "outcome" TYPE "ContactOutcome"
  USING (CASE WHEN "outcome"::text = 'OTHER' THEN 'DISPATCHED' ELSE "outcome"::text END)::"ContactOutcome";
DROP TYPE "ContactOutcome_old";
```

Old `OTHER` rows become `DISPATCHED` rather than `DELIVERED`. The migration cannot tell a
stale placeholder from a past escalation, and `DISPATCHED` is the honest reading of both:
QCobro never learned what happened. It is also the conservative direction for a KPI whose
defect is over-counting. The cost is that those rows are unresolved forever — their CDR
tracking window is long gone — which the follow-up sweeper should surface rather than hide.

## Out of scope: the stale-`DISPATCHED` sweeper

Voice has CDR-based finalization with an attempt budget. SMS only finalizes when
`twilio.webhookBaseUrl` is configured, so an unconfigured deployment leaves gestións at
`DISPATCHED` forever, as do the backfilled rows above. The spec requires that such a gestión
count as unresolved and never as a contact, which keeps the KPI honest, but nothing
force-closes the row. A sweeper — and the question of which terminal outcome a timed-out
placeholder deserves per channel — is a separate change.
