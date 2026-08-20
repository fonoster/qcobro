# Design — contact-log-axes

## The three questions

Every gestión answers up to three independent questions. Collapsing them into one enum is
what made every value ambiguous.

| axis             | question                            | null?                            |
| :--------------- | :---------------------------------- | :------------------------------- |
| `entrega`        | Did it reach the device/inbox?      | never                            |
| `deliveryReason` | If not, why?                        | only when `entrega = FAILED`     |
| `camino`         | What path did the interaction take? | when no interaction was observed |
| `resultado`      | What came of the engagement?        | usually — nothing came of it     |

They are independent, not a hierarchy. A `FAILED` delivery can still carry a `resultado` when
a human answers and hangs up on a wrong-party identification; a `DELIVERED` message very often
carries neither `camino` nor `resultado`.

## Per-channel reachable states

| channel             | `entrega` | `camino`       | `resultado`                        |
| :------------------ | :-------- | :------------- | :--------------------------------- |
| `SMS`               | all three | — never        | — never (no inbound ingest exists) |
| `VOICE_PRERECORDED` | all three | — never        | — never                            |
| `VOICE_AI`          | all three | all three      | any                                |
| `EMAIL`             | all three | `ENGAGED` only | any                                |
| `WHATSAPP`          | all three | `ENGAGED` only | any                                |

`SMS` and `VOICE_PRERECORDED` have no inbound path at all — `mods/apiserver/src/functions/sms/`
contains only `recordSmsDeliveryStatus`, and there is no `ingestSms*` anywhere. So `camino` and
`resultado` are not merely usually-null there, they are unreachable. The console renders
`resultado` only when non-null, which needs no channel table and degrades correctly if SMS ever
becomes two-way.

`VOICEMAIL` and `ABANDONED` are only reachable on `VOICE_AI`, and `VOICEMAIL` cannot actually be
detected until AMD lands (issue #83). It is specified now so the enum does not need a second
migration later.

## Back-fill mapping

Postgres cannot `ALTER TYPE ... DROP VALUE`, and a value added in a transaction cannot be used
in that same transaction. So each new enum is created fresh, the three columns are added, filled
from the old `outcome` in a single `UPDATE`, and the old type is dropped.

| old `outcome`            | → `entrega`  | `deliveryReason`      | `camino`  | `resultado`           |
| :----------------------- | :----------- | :-------------------- | :-------- | :-------------------- |
| `OTHER`                  | `DISPATCHED` | —                     | —         | —                     |
| `DELIVERED`              | `DELIVERED`  | —                     | —         | —                     |
| `NOT_DELIVERED`          | `FAILED`     | `UNREACHABLE`         | —         | —                     |
| `NO_ANSWER`              | `FAILED`     | `NO_ANSWER`           | —         | —                     |
| `WRONG_NUMBER`           | `FAILED`     | `INVALID_DESTINATION` | —         | —                     |
| `PAYMENT_PROMISE`        | `DELIVERED`  | —                     | `ENGAGED` | `PAYMENT_PROMISE`     |
| `PARTIAL_PAYMENT_AGREED` | `DELIVERED`  | —                     | `ENGAGED` | `PAYMENT_PROMISE`     |
| `NEW_TERMS`              | `DELIVERED`  | —                     | `ENGAGED` | `NEW_TERMS`           |
| `PAID`                   | `DELIVERED`  | —                     | `ENGAGED` | `PAID`                |
| `CALLBACK_REQUESTED`     | `DELIVERED`  | —                     | `ENGAGED` | `CALLBACK_REQUESTED`  |
| `DISPUTE_RAISED`         | `DELIVERED`  | —                     | `ENGAGED` | `DISPUTE_RAISED`      |
| `INFORMATION_REQUEST`    | `DELIVERED`  | —                     | `ENGAGED` | `INFORMATION_REQUEST` |
| `REFUSED`                | `DELIVERED`  | —                     | `ENGAGED` | `REFUSED`             |
| `OPT_OUT`                | `DELIVERED`  | —                     | `ENGAGED` | `OPT_OUT`             |
| `RESOLVED`               | `DELIVERED`  | —                     | `ENGAGED` | `RESOLVED`            |

Two deliberate imprecisions, both irreversible in the old data and both conservative:

- **`WRONG_NUMBER` back-fills as a delivery failure**, not as `WRONG_PARTY`. The old value
  cannot distinguish the two, and calling a carrier rejection an "engagement" would inflate the
  contactability numerator. Historical wrong-party conversations are therefore undercounted;
  going forward the two are distinct.
- **`NOT_DELIVERED` back-fills to `UNREACHABLE`**, the least specific failure reason, because
  the old value carried no reason.

## Why one change, not two slices

`entrega` alone would be shippable, but splitting costs a second enum migration over the same
column plus a second round of console churn, and the funnel — the reason for the work — needs
all three axes before any of it is computable. Sequencing was left open in discussion; this is
the assumption unless overridden.

## `webhookBaseUrl` becomes required within its section

Today `fonoster.webhookBaseUrl` and `twilio.webhookBaseUrl` are `.optional()` inside sections
that are themselves `.optional()`. That produces a configuration in which SMS dispatches
successfully but no status callback ever arrives, so the gestión sits at the placeholder
forever — which the current spec blesses as expected behavior.

Making the field required _within_ its section (the sections stay optional) means: no `twilio`
section → SMS is disabled → no stranded rows. Local development is unaffected, since a dev
without the section simply has no SMS.

This deletes the `NO_CALLBACK_CONFIGURED` / `AWAITING_CALLBACK` states we would otherwise have
needed, and the "SMS remains fire-and-forget" scenario. It does **not** eliminate incidental
stuck `DISPATCHED` rows — a dropped webhook still strands one — but it reclassifies them from
expected behavior into anomalies worth alerting on.

It also raises the stakes on the unauthenticated `POST /api/voice/events`, which is now
load-bearing for correctness rather than merely for enrichment.

## Escalation gets no representation

The autopilots' `escalate` action is not persisted today: in `ingestEmailReply.ts`,
`ingestWhatsAppMessage.ts`, and `runAutopilotEvaluation.ts` it is a local variable whose only
effect is suppressing an auto-reply. Its sole trace was writing `OTHER`, which this change
deletes.

That is a real loss of findability: when the autopilot escalates, a debtor's message goes
unanswered and nobody is told. But it needs a **view, not a column** — the email and WhatsApp
threads already carry direction and timestamp per message, so "last message inbound, no
outbound after it" is exactly the escalation signature. Tracked separately as a
"conversaciones sin respuesta" filter rather than denormalized onto the gestión.
