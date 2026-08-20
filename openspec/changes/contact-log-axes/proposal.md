## Why

`ContactOutcome` is a flattened union of three orthogonal questions, so no metric can be
written over it and no value means one thing.

The design file shows the bug directly: the **SMS** and **Pre-grabada** gestión detail blocks
render `Resultado: Entregado` — a _delivery_ word sitting in the outcome row — while the Voz IA
block renders `Resultado: Promesa de pago`, an actual outcome. Same field, different questions.

Concretely:

- **`WRONG_NUMBER` means two opposite things.** A carrier rejecting the number is a delivery
  failure. A human answering and saying "that's not me" is a delivery _success_ carrying one of
  the most valuable outcomes we can record. Today they are the same value, so a debtor who
  answered and identified themselves as the wrong party counts as never contacted.
- **`OTHER` appears in three distinct meanings** — dispatch placeholder, autopilot escalation,
  and unclassifiable conversation.
- **Nothing can represent voicemail, an instant hangup, or read-but-unengaged.**
- **`channelData.deliveryStatus` already carries delivery state** but is untyped JSON, so it is
  not queryable and the console reverse-engineers delivery from it with string sniffing.
- **The funnel — delivery rate, engagement rate, conversion rate — is uncomputable.** This is
  the reason the contactability KPI has no correct definition today.

## What Changes

Split `outcome` into three independent, individually queryable axes.

- **`entrega`** — did it reach the device or inbox: `DISPATCHED` · `DELIVERED` · `FAILED`.
  Never null; every gestión starts at `DISPATCHED`.
- **`deliveryReason`** — why delivery failed: `NO_ANSWER` · `BUSY` · `UNREACHABLE` ·
  `PROVIDER_ERROR` · `CHANNEL_UNSUPPORTED` · `INVALID_DESTINATION` · `REJECTED`. Set only when
  `entrega` is `FAILED`. Chosen so retry policy can branch on it later.
- **`camino`** — what path the interaction took: `ENGAGED` · `ABANDONED` · `VOICEMAIL`. Null
  when no interaction was observed. Structurally impossible on `SMS` and `VOICE_PRERECORDED`.
- **`resultado`** — what came of the engagement: `PAYMENT_PROMISE` · `NEW_TERMS` · `PAID` ·
  `CALLBACK_REQUESTED` · `DISPUTE_RAISED` · `INFORMATION_REQUEST` · `REFUSED` · `OPT_OUT` ·
  `WRONG_PARTY` · `RESOLVED`. Nullable, single-valued, and the common case is null.

Retirements:

- **`OTHER` is deleted outright.** The dispatch placeholder becomes `entrega: DISPATCHED`;
  escalation gets no representation (it is not persisted today either); "a conversation we
  can't classify" is already said by `camino: ENGAGED` with a null `resultado`.
- **`WRONG_NUMBER` is retired and split.** Carrier rejection becomes
  `entrega: FAILED` + `deliveryReason: INVALID_DESTINATION`; a human saying "not me" becomes
  `camino: ENGAGED` + `resultado: WRONG_PARTY`.
- **`PARTIAL_PAYMENT_AGREED` folds into `PAYMENT_PROMISE`** — the amount already lives in
  `intentMetadata.promisedAmount`, so a partial agreement was never a distinct kind of thing.
- **`DELIVERED` / `NOT_DELIVERED` / `NO_ANSWER` move to the delivery axis** and stop being
  outcomes at all.

Supporting changes:

- **`webhookBaseUrl` becomes required within its section** for both `fonoster` and `twilio`.
  Both sections stay `.optional()`, so omitting the `twilio` section disables SMS entirely
  rather than stranding gestións at `DISPATCHED` forever. This deletes the "SMS remains
  fire-and-forget when the webhook is not configured" behavior.
- **Contactability is finally definable**: an account is _contacted_ when it has at least one
  gestión with `entrega = DELIVERED`. Both counts exclude archived accounts and accounts in
  archived portfolios.
- **Console** — the gestión detail's metadata gains a flat `Entrega` field (with the failure
  reason appended after a middot) and renames the arrow progression to `Camino`; `Resultado`
  becomes a body-level row shown only when non-null. The Gestiones list drops the mostly-empty
  "Resumen IA" column for `ENTREGA` + `RESULTADO`, and the single mixed outcome filter splits
  into an entrega filter and a resultado filter.

Out of scope: modelling read-but-unengaged (so read rate stays uncomputable — `Leído` remains
a display-only stage from `channelData.openedAt`); `VOICEMAIL` detection, which is blocked on
AMD (issue #83); an escalation worklist; two-way SMS.

## Capabilities

### Modified Capabilities

- `account-contact-log`: a gestión SHALL carry three independent axes — `entrega` (+
  `deliveryReason`), `camino`, and `resultado` — replacing the single `outcome`. Channel
  bounds, delivery finalization, and outcome-driven triggers are restated against them.
- `web-console`: the gestión detail SHALL show `Entrega`, `Camino`, and a `Resultado` row
  rendered only when non-null; the Gestiones list SHALL show `ENTREGA` and `RESULTADO` columns
  and offer independent filters for each.
- `prerecorded-audio`: pre-recorded call completion SHALL set `entrega` rather than `outcome`.
- `portfolios`: adds a workspace contactability statistic defined over `entrega`.
- `campaign-triggers`: the `WRONG_NUMBER` trigger type is removed; the engine SHALL NOT infer
  suppression from a delivery failure or an identity claim.
- `portfolio-accounts`: `IntentStatus` loses `WRONG_NUMBER`, retaining `INTENT_MET` and
  `OPT_OUT`.

## Impact

- **Breaking API change.** `outcome` disappears from `accountContactLog.create`, from the
  public `POST /api/contact-logs` ingress, and from `gestiones.list` filters. There is no
  deprecation window — the field cannot be faithfully synthesized from the new axes.
- **Prisma migration over every historical row.** Postgres cannot drop an enum value, so each
  new enum is created fresh and `outcome` is back-filled into the three columns in the `USING`
  clause, then dropped. Back-fill mapping is in `design.md`.
- **`mods/common`**: `contactOutcomeSchema` is replaced by `entregaSchema`,
  `deliveryReasonSchema`, `caminoSchema`, and `resultadoSchema`.
- **`mods/apiserver`**: `recordOutcome`, the SMS/voice/email/WhatsApp finalizers, the autopilots,
  `decideVoiceOutcome`, and the trigger logic all move to the new axes. The no-downgrade rank
  guard collapses into "`entrega` only advances `DISPATCHED → DELIVERED|FAILED`".
- **`mods/webapp`**: the 45-line `deliveryValue` switch in `GestionDetail.tsx` is deleted
  outright; `Resultado` moves out of the AI-insights section (fixing a bug where it vanished
  when no insight existed); the duplicate `Target` icon on the payment promise is removed to
  match Pencil.
- **Supersedes PR #96**, which added `DISPATCHED` as an _outcome_ and removed `OTHER` from the
  public ingress.
- **The engine stops benching accounts for bad numbers.** `intentStatus.WRONG_NUMBER` and the
  `WRONG_NUMBER` campaign trigger are **deleted outright** — nothing would populate them, and
  dormant enum values are dead weight. `WRONG_PARTY` becomes a recorded fact on the gestión
  with no account-level side effect.

  This is a live behavior change: today a `WRONG_NUMBER` outcome permanently removes an
  account from _every_ campaign, so accounts with dead numbers will now stay in rotation and
  keep being dialled until an explicit Do Not Contact entry exists (**issue #101**). Accepted
  deliberately — the alternative was keeping a suppression rule driven by an unverifiable
  identity claim or a possibly-transient carrier error. Note the current behavior is wrong in
  the other direction too: one transient failure can bench an account forever.

- **`IntentStatus` is reduced to a single value, `INTENT_MET`.** `OPT_OUT` is deleted along
  with `WRONG_NUMBER`, and the `OPT_OUT` campaign trigger goes with it. `INTENT_MET` survives
  because it is a statement about the _debt_ — it is settled, there is nothing left to collect
  — rather than an inference about a contact point.

  `resultado: OPT_OUT` still **records** that someone asked us to stop, and it is visible in
  the console; it simply no longer sets an account flag. Opt-out will have a single source of
  truth, the Do Not Contact list (#101).

  **Accepted gap, stated plainly:** until #101 ships, a request to stop contact is recorded
  but **not enforced** — the engine will keep dispatching to that account on live channels
  (voice, email) unless an operator intervenes. WhatsApp's platform-level opt-out
  (Meta error 131050) likewise stops writing anything; that channel is not currently in use.
  This is a deliberate decision to have one suppression mechanism rather than two, taken with
  the interim exposure understood.

  **Scale:** QCobro currently has one production customer on preview terms with about two days
  of campaign history, so the population affected by this gap is a handful of accounts at most,
  and working them by hand through the new `resultado` filter is entirely tractable. The gap is
  a real obligation, not a large one.
