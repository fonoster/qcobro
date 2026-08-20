## 1. Shared contracts (`mods/common`)

- [x] 1.1 Replace `contactOutcomeSchema` in `src/schemas/contactLog.ts` with `entregaSchema`
      (`DISPATCHED` `DELIVERED` `FAILED`), `deliveryReasonSchema` (7 values), `caminoSchema`
      (`ENGAGED` `ABANDONED` `VOICEMAIL`), and `resultadoSchema` (10 values)
- [x] 1.2 Export `CHANNEL_CAN_ENGAGE` (`VOICE_AI`, `EMAIL`, `WHATSAPP`) so the console and the
      validators share one definition of which channels can produce `camino`/`resultado`
- [x] 1.3 Add a refinement asserting `deliveryReason` is present iff `entrega === "FAILED"`,
      and that `camino`/`resultado` are null for `SMS` and `VOICE_PRERECORDED`
- [x] 1.4 ~~Delete `CHANNEL_FAILED_OUTCOMES` and `CONTACT_OUTCOME_RANK`~~ — N/A: those were
      introduced by PR #96, which this change supersedes and which never merged. Verified absent.

## 2. Database (`mods/apiserver/prisma`)

- [x] 2.1 Add `Entrega`, `DeliveryReason`, `Camino`, `Resultado` enums and the four columns to
      `AccountContactLog`; `entrega` NOT NULL defaulting to `DISPATCHED`
- [x] 2.2 Write the back-fill `UPDATE` from `outcome` per the mapping table in `design.md` —
      one statement, all rows, before the old column is dropped
- [x] 2.3 Drop `outcome` and `DROP TYPE "ContactOutcome"`. Postgres cannot drop an enum value,
      so the type goes away wholesale rather than being altered
- [x] 2.4 Index `entrega` (contactability counts filter on it) and `resultado`
- [x] 2.5 Verify the migration on a copy of a seeded database — row counts per axis before and
      after must reconcile with the mapping table

## 3. Config

- [x] 3.1 Make `webhookBaseUrl` required inside `fonosterConfigSchema` and `twilioConfigSchema`
      in `mods/common/src/config.ts` (the sections themselves stay `.optional()`)
- [x] 3.2 Update `qcobro-prod.json` and any example/dev config that omits it
- [x] 3.3 Confirm startup fails with a readable message when a section is present without it

## 4. Write paths (`mods/apiserver`)

- [x] 4.1 `functions/campaigns/recordOutcome.ts` — take the three axes; replace the rank-based
      no-downgrade guard with "`entrega` only advances out of `DISPATCHED`"
- [x] 4.2 `functions/campaigns/engine.ts`, `functions/outreach/*`,
      `functions/campaigns/followUpPaymentPromise.ts` — write `entrega: DISPATCHED` at dispatch
- [x] 4.3 `functions/sms/recordSmsDeliveryStatus.ts` — map Twilio error codes to
      `deliveryReason` (`INVALID_DESTINATION`, `CHANNEL_UNSUPPORTED`, `REJECTED`,
      `PROVIDER_ERROR`)
- [x] 4.4 `functions/voice/resolveVoiceCallFromCdr.ts` + `recordVoiceAiCallStatus.ts` — map CDR
      clearing causes to `deliveryReason` (`NO_ANSWER`, `BUSY`, `UNREACHABLE`, `PROVIDER_ERROR`)
- [x] 4.5 `functions/voice/recordPrerecordedOutcome.ts` — set `entrega` only; never `camino`
      or `resultado`
- [x] 4.6 `functions/voice/decideVoiceOutcome.ts` — split into a `camino` decision and a
      `resultado` decision; drop `OTHER` and `WRONG_NUMBER` from the valid set
- [x] 4.7 `functions/email/ingestEmailReply.ts` + `functions/whatsApp/ingestWhatsAppMessage.ts`
      — an inbound reply advances `DISPATCHED → DELIVERED` and sets `camino: ENGAGED`
- [x] 4.8 Autopilots (`voiceAutopilot`, `emailAutopilot`, `whatsAppAutopilot`) — `escalate`
      writes nothing; it stays a local decision that suppresses the auto-reply
- [x] 4.9 Trigger logic — `PAID`/`RESOLVED` set `INTENT_MET`, and that is now the **only**
      automatic global suppression. Neither a `FAILED` entrega, nor `resultado: WRONG_PARTY`,
      nor `resultado: OPT_OUT` sets any account-level flag
- [x] 4.9a **Reduce `IntentStatus` to `INTENT_MET` alone** — delete `WRONG_NUMBER` and
      `OPT_OUT` from the Prisma enum, and delete both from `TriggerType`
- [x] 4.9b Strip both values from `globalIntentFor` (`recordOutcome.ts:14-22`),
      `GLOBAL_SUPPRESSED` (`engine/funnel.ts:36`), `mods/common/src/types/campaigns.ts:42-43`,
      the `Gestiones.tsx:35-36` filter list, and both i18n locales
      (`i18n.tsx:420-421`, `:997-998`)
- [x] 4.9c `rest/whatsAppWebhook.ts:260` — the Meta-131050 handler stops writing
      `intentStatus`. Keep recording the status on the gestión; the account flag goes away.
      Channel is not in use, so this is inert today (see #101)
- [x] 4.9d Autopilots keep classifying `OPT_OUT` and stop returning `WRONG_NUMBER`
      (`voiceAutopilot.ts:80`, `emailAutopilot.ts:65`, `whatsAppAutopilot.ts:64`) — `OPT_OUT`
      remains a valid `resultado`, it just has no side effect
- [x] 4.9e Migration for the two enums: null out `PortfolioAccount.intentStatus` where it is
      `WRONG_NUMBER` or `OPT_OUT`, delete `CampaignTrigger` rows of those types, then recreate
      both enums without the values (Postgres cannot drop an enum value in place). **Record how
      many accounts lose an `OPT_OUT` flag** — those are people who asked not to be contacted
      and who will re-enter rotation; the list is needed to seed the DNC list in #101
- [x] 4.10 `PARTIAL_PAYMENT_AGREED` call sites become `PAYMENT_PROMISE` with the amount in
      `intentMetadata.promisedAmount`
- [x] 4.11 ~~Fix here~~ → **filed as issue #100**, deliberately unfixed. `NEW_TERMS` currently creates no PaymentPromise and sets no `suppressUntil`,
      despite the spec requiring a grace window\*\* — confirmed by grep, the constant appears
      nowhere in `recordOutcome.ts` or the engine. Fix it here or file it explicitly

## 5. Read paths + transport

- [x] 5.1 `functions/portfolios/contactStats.ts` — numerator becomes `entrega: DELIVERED`
      (replacing the `notIn CHANNEL_FAILED_OUTCOMES` exclusion); keep the archived-portfolio
      filter on the denominator
- [x] 5.2 `gestiones.list` — filter by `entrega` and `resultado` independently; remove the
      single mixed `outcome` filter
- [x] 5.3 `POST /api/contact-logs` REST ingress — accept the three axes; reject `outcome`
      with a clear error rather than silently ignoring it
- [x] 5.4 Update `docs-site/api/contact-log.mdx` (Spanish prose, no internal service names,
      realistic `WO...` ids per the docs editorial policy)

## 6. Console (`mods/webapp`) — Storybook-first

- [~] 6.1 `Entrega` renders as a plain string inside the existing `MetaItem` — no component of
  its own, so nothing to story. The `Fallido · <reason>` middot form is built by
  `entregaLabel()` in `lib/contactAxes.ts`. **Deviation from Storybook-first, deliberate:**
  extracting a component purely to host a story would be churn the "least UI change"
  constraint rules out.
- [~] 6.2 Same for `Camino` — a plain string from `caminoPath()` inside `MetaItem`.
- [x] 6.3 Story + component for the `Resultado` row, including the null case (renders nothing)
      and the `PAYMENT_PROMISE` case carrying amount + due date
- [x] 6.4 `GestionDetail.tsx` — **delete the 45-line `deliveryValue` switch** (`:239-284`) and
      its `channelData.deliveryStatus` string-sniffing
- [x] 6.5 `GestionDetail.tsx` — move `Resultado` out of the AI-insights sections (`:561`,
      `:616`, `:744`) to a body-level row, so it no longer vanishes when `insight` is empty
- [x] 6.6 `GestionDetail.tsx` — delete the separate PaymentPromise section (`:571-600`) and its
      **duplicate `Target` icon** (`:573` header + `:583` inside the card); the promise renders
      in the `Resultado` row, matching Pencil
- [x] 6.7 `Gestiones.tsx` — drop the `aiSummary` column; add `ENTREGA` and `RESULTADO`; render
      `—` for a null resultado
- [x] 6.8 `Gestiones.tsx` — split the outcome filter into an entrega filter and a resultado
      filter
- [x] 6.9 i18n (`lib/i18n.tsx`) — `gestiones.entrega.*`, `gestiones.deliveryReason.*`,
      `gestiones.camino.*`, `gestiones.resultado.*` in **both** es and en, including the
      per-channel label variants (`DELIVERED` → "Conectada" on voice, "Entregado" elsewhere;
      `ENGAGED` → "Conversación" on voice, "Respondió" on threaded channels). Delete
      `gestiones.outcome.*`
- [x] 6.10 Confirm no hardcoded user-facing strings were introduced

## 7. Test

- [x] 7.1 Unit-test each changed validated function with `node:test` + `node:assert/strict`
      (**not** mocha/sinon — CLAUDE.md is stale), including a validation-failure case per
      function asserting the structured error and that the side effect never fired
- [x] 7.2 Test the axis invariants: `deliveryReason` iff `FAILED`; `camino`/`resultado` null on
      `SMS` and `VOICE_PRERECORDED`; `entrega` never regresses
- [x] 7.3 Test `contactStats` over the new numerator, including the archived-portfolio case
- [x] 7.4 Test the back-fill mapping against a fixture covering all 15 old enum values
- [x] 7.5 Playwright golden path: open a gestión, see `Entrega`/`Camino`/`Resultado`; filter the
      list by entrega and by resultado
- [x] 7.6 `npm run lint`, `npm run typecheck --workspace ...`, and the test suites green
      (lerna resolves to the MAIN checkout from a worktree — use `--workspace`)
- [ ] 7.7 Run the real dev stack once against live Twilio/Fonoster before opening the PR — this
      change is integration-heavy and mocked tests will not catch a bad reason mapping

## 9. Release gates (single-change migration — no code-only rollback)

The user chose a single migration over expand/contract, so these are **hard gates**, not
nice-to-haves. `DROP TYPE "ContactOutcome"` cannot be reversed by redeploying old code.

- [ ] 9.1 Exercise the full change against a real local stack: dispatch on each of the five
      channels, let the real Twilio/Fonoster callbacks land, and confirm every gestión leaves
      `DISPATCHED` with the right `entrega` and `deliveryReason`
- [ ] 9.2 Restore a production-shaped dump into a scratch database, run the migration against
      it, and reconcile row counts per axis against the `design.md` mapping table
- [ ] 9.3 Take a verified, **restorable** backup immediately before the production migration —
      verified means actually restored somewhere, not just written
- [ ] 9.4 Confirm the deployed (mounted) `qcobro.json` carries `fonoster.webhookBaseUrl` and
      `twilio.webhookBaseUrl` — after this change a section without one refuses to boot
- [ ] 9.5 Plan for the deploy window: gestión writes fail between migration and new code going
      live. Twilio/Fonoster retry their webhooks, but **voice calls in flight lose their
      completion signal** — deploy at a quiet hour, or pause the engine across the window

## 8. Design

- [x] 8.1 Copy the approved `pencil.pen` from the main checkout into this worktree before
      committing (the design was iterated in the file the user has open)
