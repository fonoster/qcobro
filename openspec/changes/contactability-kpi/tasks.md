## 1. Reshape `ContactOutcome`

- [x] 1.1 In `contactOutcomeSchema` (`mods/common/src/schemas/contactLog.ts`): add
      `DISPATCHED`, remove `OTHER`
- [x] 1.2 Same change to the Prisma `ContactOutcome` enum
      (`mods/apiserver/prisma/schema.prisma`)
- [x] 1.3 **One** migration recreating the type (Postgres has no `ALTER TYPE … DROP VALUE`),
      remapping in the `USING` clause — see design.md Decision 5 for the exact SQL. Do NOT
      use `ADD VALUE`; recreating sidesteps the "new value unusable in the same transaction"
      restriction entirely
- [x] 1.4 Export from `@qcobro/common`: the channel-failure set
      (`DISPATCHED`, `NOT_DELIVERED`, `NO_ANSWER`, `WRONG_NUMBER`) and the outcome **rank**
      map (0 = `DISPATCHED`, 1 = the four channel results, 2 = everything else) so the KPI
      query and the no-downgrade rule share one definition

## 2. Placeholder writers → `DISPATCHED`

- [x] 2.1 `mods/apiserver/src/engine/engine.ts:530` — dispatch-time gestión
- [x] 2.2 `mods/apiserver/src/trpc/routers/outreach.ts:283` — manual outreach
- [x] 2.3 `mods/apiserver/src/functions/campaigns/followUpPaymentPromise.ts:44` — promise
      follow-up
- [x] 2.4 Update the comments naming the "OTHER placeholder" (engine.ts:137, engine.ts:548,
      outreach.ts:323, startVoiceCallStatusTracking.ts:23, followUpPaymentPromise.ts:15,
      recordSmsDeliveryStatus.ts:40/61, recordPrerecordedOutcome.ts:34/39/52,
      recordVoiceAiCallStatus.ts:40/55, `mods/common/src/types/dispatch.ts:64`)

## 3. Autopilots stop inventing an outcome

- [x] 3.1 `escalate` carries no outcome: `voiceAutopilot.ts:83`, `emailAutopilot.ts:68`,
      `whatsAppAutopilot.ts:67` return `{ action: "escalate" }`. Verify the decision schema
      already makes `outcome` optional (`decideVoiceOutcome` handles a null outcome today)
- [x] 3.2 Remove `"OTHER"` from the `VALID_OUTCOMES` sets and drop the
      unrecognized-value fallback — write no outcome instead: `decideVoiceOutcome.ts:54,89`,
      `ingestEmailReply.ts:162,166`, `ingestWhatsAppMessage.ts:168,172`
- [x] 3.3 `DISPATCHED` is never accepted from an autopilot or from an operator recording a
      gestión by hand — keep it out of those `VALID_OUTCOMES` sets

## 4. Inbound replies prove delivery

- [x] 4.1 `ingestEmailReply.ts` — when the correlated gestión is still `DISPATCHED`, finalize
      it to `DELIVERED` before applying the autopilot decision
- [x] 4.2 `ingestWhatsAppMessage.ts` — same
- [x] 4.3 Confirm the ranking (task 5.4) means a later `PAYMENT_PROMISE` still upgrades that
      `DELIVERED`, and that a second reply does not downgrade a recorded outcome

## 5. Finalization guards → `DISPATCHED`, and the monotonic rule

- [x] 5.1 `recordSmsDeliveryStatus.ts:64` — `match.outcome === "DISPATCHED"`
- [x] 5.2 `recordVoiceAiCallStatus.ts:56` — same
- [x] 5.3 `recordPrerecordedOutcome.ts:53` — same; check `resolveVoiceCallFromCdr.ts` for the
      same guard
- [x] 5.4 `recordOutcomeTx` (`campaigns/recordOutcome.ts:207-211`) — replace the
      `OTHER`-shaped special case with the rank comparison: keep the existing outcome when
      the incoming one ranks strictly lower. design.md Decision 2 has the truth table;
      implement and test every row

## 6. Contactability query

- [x] 6.1 Rewrite `portfolios.contactStats`
      (`mods/apiserver/src/trpc/routers/portfolios.ts:34-44`): keep the denominator, change
      the numerator to
      `contactLogs: { some: { outcome: { notIn: CHANNEL_FAILED_OUTCOMES } } }`
- [x] 6.2 Leave `reserveAttemptTx` and `lastContactedAt` untouched — attempt counting and the
      daily cap depend on the current meaning

## 7. Console

- [x] 7.1 In `mods/webapp/src/pages/Gestiones.tsx:23` — add `DISPATCHED` to `OUTCOMES`,
      remove `OTHER`
- [x] 7.2 `mods/webapp/src/lib/i18n.tsx` — add `gestiones.outcome.DISPATCHED` ("Sent" /
      "Enviado" — a pending state, distinct from `DELIVERED` "Delivered" / "Entregado") and
      remove `gestiones.outcome.OTHER` from both dictionaries
- [x] 7.3 Check `GestionDetail.tsx` and any outcome→badge/label mapping for a switch that now
      needs the new value or still references the removed one

## 8. Docs

- [x] 8.1 `docs-site/api/contact-log.mdx:53` — update the valid-outcome list on the public
      external ingress. Note the docs-site editorial policy (no internal service/library
      names, Spanish prose, realistic `WO...` example IDs)

## 9. Tests

- [x] 9.1 `contactStats` — failed-only account excluded; `PAYMENT_PROMISE`-only account
      included; `DISPATCHED`-only account excluded; account with several failures and one
      `DELIVERED` counted once; never-attempted account in the denominator only; archived
      accounts excluded from both
- [x] 9.2 `recordOutcome.test.ts` — every row of the Decision 2 truth table, especially
      `existing=PAYMENT_PROMISE, incoming=DELIVERED → PAYMENT_PROMISE` (the no-downgrade
      guarantee, which today's guard does NOT provide) and
      `existing=DELIVERED, incoming=PAYMENT_PROMISE → PAYMENT_PROMISE`
- [x] 9.3 Inbound-reply-proves-delivery for email and WhatsApp, including the
      escalate-without-classifying path
- [x] 9.4 Update `createContactLog.test.ts`, the SMS/voice finalization tests, and the
      autopilot tests that assert `OTHER`
- [x] 9.5 `npm run typecheck` / `test` per workspace (`--workspace @qcobro/common`,
      `@qcobro/apiserver`, `@qcobro/webapp`) — lerna resolves to the main checkout from a
      worktree and will report stale results
- [x] 9.6 Apply the migration against a real Postgres; confirm no `OTHER` rows survive and
      the type no longer carries the value

## 10. Follow-up (not in this change)

- [ ] 10.1 File an issue for a sweeper that force-finalizes gestións stuck at `DISPATCHED`
      past a bounded window — SMS only finalizes when `twilio.webhookBaseUrl` is configured,
      and the backfilled rows from 1.3 are unresolved by construction
