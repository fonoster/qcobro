# Deliverability

How QCobro knows a message reached the debtor, how long a voice call lasted, and how those
two facts flow into **billing** and into the **Gestiones** reporting surface — per channel.

This is a design-findings document reconciling the current specs
(`openspec/specs/`) with two product decisions recorded at the end (§5). It is the
human-readable companion to the specs; the specs remain the source of truth.

---

## 1. The delivery model at a glance

Every outreach attempt is one **gestión** (`AccountContactLog`) carrying a single structured
`outcome`. Channels fall into two tiers by how much QCobro can observe:

| Tier                | Channels                                             | What "delivered" means                                                               | Outcome vocabulary              |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| **Fire-and-forget** | `SMS`                                                | Handed to the provider; carrier confirmation is best-effort                          | `DELIVERED` / `NOT_DELIVERED`   |
| **Observed**        | `VOICE_PRERECORDED`, `VOICE_AI`, `EMAIL`, `WHATSAPP` | QCobro sees a real completion signal (answer/hangup, transcript, thread, or webhook) | Channel-appropriate — see below |

> **Change from the original spec.** `account-contact-log/spec.md:82` still groups
> `VOICE_PRERECORDED` with `SMS` as "fire-and-forget." Decision §5.1 **moves pre-recorded into
> the Observed tier**, because QCobro runs the pre-recorded VoiceServer itself and can watch the
> call answer and hang up. The spec should be updated to match.

The evidence of delivery lives in each gestión's `channelData`
(`account-contact-log/spec.md:63-67`):

- **SMS / WhatsApp** → `{ messageSid, deliveryStatus }`
- **Email** → `{ messageId, deliveryStatus, openedAt? }`
- **Voice** → `{ callSid, recordingUrl?, transcriptUrl?, transcriptText? }` + `durationSeconds`

---

## 2. Billing depends on delivery differently per meter

Two billing models, split by meter kind (`billing-plans/spec.md:33-56`, `usage-ledger/spec.md`):

### Message meters — `sms`, `email`, `whatsappMessage`

- Billed **`perMessage`, at send time**. The `UsageRecord` is written in the _same
  transaction_ as the contact-log write (`usage-ledger/spec.md:13`).
- **Delivery status does not change the bill.** An SMS that is sent but never confirmed
  delivered is still billed. The second checkmark is a **reporting** signal, never a billing
  signal.

### Voice meters — `voicePrerecorded`, `voiceAi`

- Billed on **answered duration** via the increment formula
  (`initial + ceil((duration − initial) / subsequent) × subsequent`, then
  `billedSeconds × perMinute / 60`).
- Flow: **debit an estimate at dispatch → settle on completion** with the real answered
  duration (`usage-ledger/spec.md:63-80`).
- **Unanswered = net zero.** Here delivery _is_ billing: answered → billable, unanswered →
  the settlement fully reverses the estimate. Voicemail pickup counts as answered.

**One-line rule:** _messages bill on send; voice bills on answered seconds._ Getting this
backwards (billing SMS on the delivery callback, or billing voice on dispatch) is the easiest
mistake — call it out in implementation.

---

## 3. Per-channel deep dive

| Channel                                | Fire-and-forget?                         | How it's billed                                                 | Possible delivery statuses                                      | Lifecycle                                                                          |
| -------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **SMS**                                | **Yes**                                  | `perMessage` at **send** — delivery never re-bills              | `Sent` · `Delivered` · `Undelivered`/`Failed`                   | `Sent → Delivered` &nbsp;(or `Sent → Undelivered`)                                 |
| **Pre-recorded** (`VOICE_PRERECORDED`) | **No** — observed via QCobro VoiceServer | Voice **answered-duration** (estimate → settle; unanswered = 0) | `Delivered` (answered) · `Not delivered` (no answer/failed)     | `Sent → Delivered` (answered; **duration captured**) &nbsp;(or `Sent → No Answer`) |
| **Voice AI** (`VOICE_AI`)              | **No** — observed via events-hook        | Voice **answered-duration** (estimate → settle; unanswered = 0) | `No Answer` · `Answered` · [conversational outcome]             | `Sent → Answered → Conversación → Finalizada` &nbsp;(or `Sent → No Answer`)        |
| **Email** (`EMAIL`)                    | **No** — conversational thread           | `perMessage` at **send**                                        | `Sent` · `Delivered` · `Opened` · `Replied`                     | `Sent → Delivered → Opened → Replied` (thread continues)                           |
| **WhatsApp** (`WHATSAPP`)              | **No** — conversational thread           | `perMessage` at **send**                                        | `Sent` · `Delivered` · `Read` · `Replied` (+ opt-out / quality) | `Sent → Delivered → Read → Replied`                                                |

**Notes that don't fit in a cell:**

1. **Pre-recorded `DELIVERED` = call answered, _not_ proof the customer heard it.** We do **not**
   claim playback ("Reproducido" is dropped): TTS reaching the call leg is no guarantee the human
   listened, and a mid-message hangup would still look "played." The honest signal is the
   **answered duration** the VoiceServer measures — a short duration implies an early hangup, a
   near-full duration implies they heard it. Reporting can be built on that later (§5.1); for now
   the outcome is simply `DELIVERED`/`NOT_DELIVERED`, unified with SMS.
2. **Voice billing is estimate → settle.** Both voice channels debit an estimate at dispatch and
   settle on the real answered duration via a signed adjustment, **idempotent per call ref**;
   an unanswered call fully reverses to zero. **Voicemail pickup counts as answered.**
   (`usage-ledger/spec.md:63-80`, `voice-events-hook/spec.md:35-62`)
3. **Message billing is send-time.** SMS / email / WhatsApp bill `perMessage` inside the dispatch
   transaction; the later delivery/read/open callbacks are **display-only and never re-bill**.
4. **SMS second check is left as-is.** No `POST /api/sms/status` ingestion requirement is spec'd
   yet (unlike email's `/api/email/inbound` and the WhatsApp/voice webhooks). The two-check visual
   stays while SMS evolves; SMS has **no read receipt**, so there is no third state. (§5.2, §6)
5. **Conversational channels' real signal is the thread/transcript**, not the delivery tick:
   Voz IA classifies from the transcript; email runs an autopilot reply/resolve/escalate loop;
   WhatsApp inbound opt-out sets `IntentStatus = OPT_OUT` (global suppression). Re-delivered
   webhooks never create duplicate `PaymentPromise`s.

---

## 4. Reporting surface (Gestiones)

- **List** (`web-console/spec.md:509-516`): account, channel, outcome, AI summary, timestamp;
  filterable by channel and outcome; restrained styling (monochrome channel indicator,
  plain-text outcome).
- **Detail** (`web-console/spec.md:528-544`), channel-aware — three detail shapes, not two:
  - **One-way message (SMS, pre-recorded):** the single sent message + delivery status + AI
    insight + channel metadata; **no** audio player, **no** transcript. Pre-recorded can replay
    the TTS-synthesized script.
  - **Threaded message (email, WhatsApp):** the ordered **conversation thread** — outbound and
    inbound replies with direction, sender, timestamp, body, and message id — plus delivery
    status and AI insight. Still **no** audio player or call transcript, but this is a
    back-and-forth thread, **not** a single one-way message; the outcome reflects the latest
    thread state and is never downgraded (`account-contact-log/spec.md:205-225`,
    `email-channel/spec.md`).
  - **Voz IA:** recording + transcript (rendered as conversation) + full AI analysis
    (sentiment, debt reason, result, next step) + linked `PaymentPromise` when the outcome is a
    commitment.
- **Duration** appears in the detail for voice channels from `durationSeconds` — now populated
  for _both_ voice channels (Voz IA from `conversation.ended`, pre-recorded from the VoiceServer
  hangup timing).
- **Lifecycle stepper (required):** the gestión detail SHALL render the delivery lifecycle as an
  **arrow-driven progression** showing the stages the attempt moved through, e.g.
  `Sent → Delivered` (SMS), `Sent → Delivered` with duration (pre-recorded),
  `Sent → Answered → Finalizada` (Voz IA), `Sent → Delivered → Read → Replied` (WhatsApp/email
  thread). Reached stages are active; not-yet/never-reached stages are muted. This is the primary
  visual for "what happened," replacing per-channel bespoke labels.

> **Spec inconsistency to fix:** `web-console/spec.md:533` groups **email** under the "one-way
> channels (SMS, pre-recorded, email)" detail shape, but `account-contact-log`'s _Email thread
> on the gestión_ requirement and the whole `email-channel` spec make email a **threaded,
> conversational** channel. The "one-way" grouping in `web-console` is really only about the
> _absence of an audio player / call transcript_ — it should be re-worded so email (and
> WhatsApp) render their message thread rather than "the message that was sent." See §6, item 6.

Every inbound provider signal (voice events, SMS callbacks, WhatsApp statuses, email webhooks)
is also recorded as a `provider.event` on receipt for the flight recorder, matched or not
(`engine-events/spec.md:74-92`).

---

## 5. Decisions

### 5.1 Pre-recorded voice is a non-fire-and-forget (Observed) channel

QCobro runs the pre-recorded VoiceServer as its own subprocess, so it observes call answer,
duration, and hangup directly. Therefore:

- Pre-recorded reports **`DELIVERED` / `NOT_DELIVERED`**, where `DELIVERED` = **the call was
  answered** (unified with SMS's vocabulary). We deliberately do **not** claim the message was
  heard — "Reproducido" is dropped, because TTS reaching the call leg is no proof the human
  listened and a mid-message hangup would still look "played."
- Pre-recorded reports **answered duration**, used both for billing settlement (reusing the
  existing voice estimate/settlement machinery) and as the honest "what happened" signal in the
  detail view. Storing the synthesized clip's **nominal length** alongside the answered duration
  is cheap now and enables a future "completion ratio" report (answered X of a Y-second message).
- **No HTTP callback** (unlike Voz IA's `/api/voice/events` webhook): the VoiceServer runs
  **co-located with the apiserver** (same container/process), so completion is reported
  **in-process** — it settles usage and writes/updates the gestión directly. The contract stays
  simple: **answered/not + seconds**, no playback-confirmed flag.
- The stale note "Pre-recorded has no callback by design" and the fire-and-forget classification
  in `account-contact-log/spec.md:82` are superseded and should be re-specified.

### 5.2 SMS stays as-is for now

SMS is an evolving channel. The two-checkmark visual stays; billing remains pinned to send. We
are **not** formalizing the SMS delivery-status ingestion endpoint or the coarse-outcome ↔
fine-status reconciliation in this pass. Revisit when SMS stabilizes.

---

## 6. Open items

| #   | Item                                                                                                                                                                                                   | Owner area                                                 | Note                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Re-spec `VOICE_PRERECORDED` as Observed: delivery outcome + duration from the VoiceServer, wired to voice settlement                                                                                   | `account-contact-log`, `usage-ledger`, `prerecorded-audio` | Closes the prior billing/reporting hole (§5.1)                                                |
| 2   | Pre-recorded completion is **in-process** (co-located VoiceServer, no HTTP callback): answered/unanswered, answered seconds (+ optional nominal clip length) settle usage and write the gestión inline | voice ingestion                                            | Outcome = `DELIVERED` (answered) / `NOT_DELIVERED`; keep settlement idempotent per call ref   |
| 3   | SMS delivery-status ingestion (`deliveryStatus` source for the 2nd check)                                                                                                                              | `channel-dispatch` / `engine-events`                       | **Deferred** — SMS evolving (§5.2)                                                            |
| 4   | Reconcile coarse `outcome` (`DELIVERED`/`NOT_DELIVERED`) with fine `deliveryStatus` for SMS                                                                                                            | `account-contact-log`                                      | **Deferred** with #3                                                                          |
| 5   | State the send-vs-answer billing asymmetry explicitly in a spec scenario                                                                                                                               | `usage-ledger`                                             | Prevents billing-on-delivered mistakes                                                        |
| 6   | Re-word the "one-way channels" detail requirement so **email and WhatsApp** render their message **thread**, not "the message that was sent"                                                           | `web-console`                                              | `web-console:533` contradicts the email-thread requirement; one-way = SMS + pre-recorded only |

---

## References

- `openspec/specs/account-contact-log/spec.md` — gestión fields, outcomes, tiers
- `openspec/specs/voice-events-hook/spec.md` — Voz IA completion + settlement
- `openspec/specs/prerecorded-audio/spec.md` — pre-recorded script playback
- `openspec/specs/billing-plans/spec.md` — meters, increment formula
- `openspec/specs/usage-ledger/spec.md` — priced-at-write, estimate/settlement
- `openspec/specs/web-console/spec.md` — Gestiones list + channel-aware detail
- `openspec/specs/channel-dispatch/spec.md` — dispatch triggers per channel
- `openspec/specs/engine-events/spec.md` — inbound `provider.event` recording
- `openspec/specs/email-channel/spec.md`, `openspec/specs/whatsapp-channel/spec.md`
- `config/qcobro.example.json` — `fonoster.prerecordedAppRef`, `billing.plans[].rates`
