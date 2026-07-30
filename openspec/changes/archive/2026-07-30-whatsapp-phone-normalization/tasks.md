## 1. Strict E.164 validator (validated-function pattern)

- [x] 1.1 Add `phoneNumberSchema` (`{ phone: string }`) to `mods/common/src/schemas/` (new `phone.ts`).
- [x] 1.2 Add `createValidatePhoneE164` to `mods/common/src/utils/` (new `validatePhone.ts`): factory
      wrapping `withErrorHandlingAndValidation(fn, phoneNumberSchema)`; `fn` calls the existing
      `normalizePhoneE164` and throws a `ValidationError` (structured `z.ZodError`) when it returns
      `null`.
- [x] 1.3 Export `phoneNumberSchema`/`ValidatePhoneInput` and `createValidatePhoneE164` from
      `mods/common/src/schemas/index.ts` and `mods/common/src/utils/index.ts`.
- [x] 1.4 Unit tests: valid input normalizes and returns E.164; invalid input throws
      `ValidationError` with a `phone` field error; empty string is rejected by the schema itself.

## 2. Normalize phone at CSV/account import time

- [x] 2.1 In `mods/apiserver/src/functions/portfolios/syncAccounts.ts`, validate/normalize each
      row's `phone` (when present) via `createValidatePhoneE164()` before opening the
      `$transaction` — collect normalized values first so an invalid phone fails the whole call
      before any DB write.
- [x] 2.2 Use the normalized phone (not `rest.phone`) in both the create and update `data` objects.
- [x] 2.3 Unit tests in `syncAccounts.test.ts`: a row with a non-canonical-but-parseable phone
      (e.g. `"1 (809) 123-4567"`) is stored as E.164; a row with an unparseable phone rejects the whole
      sync call and writes nothing (assert no `tx.portfolioAccount.create`/`update` calls landed).

## 3. Audit SMS/voice inbound correlation (no code expected)

- [x] 3.1 Confirm `mods/apiserver/src/functions/voice/ingestVoiceEvent.ts` correlates by
      `callRef`/providerRef, not phone — no fix needed.
- [x] 3.2 Confirm `mods/apiserver/src/functions/email/ingestEmailReply.ts` correlates by the
      reply-to token, not phone — no fix needed.
- [x] 3.3 Confirm there is no inbound SMS webhook/route in `mods/apiserver/src/rest/` — nothing to
      fix. Record this finding in the PR description (audit-only item).

## 4. Revert `loadByPhoneAndSender` to a direct, indexed/exact query

- [x] 4.1 In `mods/apiserver/src/rest/whatsAppWebhook.ts`, replace the 50-row
      `findMany` + in-JS `.find()` scan with a single `accountContactLog.findFirst` filtered by
      `agentType: "WHATSAPP"`, `channelData: { path: ["to"], equals: normalizedCustomer }`, and
      `portfolioAccount: { portfolio: { workspaceRef: sender.workspaceRef } }` (keep the PR #64
      workspace-scoping fix), ordered by `contactedAt desc`.
- [x] 4.2 Short-circuit to `null` before querying when `normalizePhoneE164(customerPhone)` returns
      `null`.
- [x] 4.3 Export `createPrismaWhatsAppInboundClient` (or otherwise make it testable) and add unit
      tests exercising the new query shape directly: exact match found, no match when
      `channelData.to` differs, no match / no query attempted when the inbound number doesn't
      parse, workspace scoping still excludes other workspaces' logs.

## 5. Verify and ship

- [x] 5.1 Run `openspec validate whatsapp-phone-normalization --strict` and fix anything flagged.
- [x] 5.2 Run lint, typecheck, and unit tests for `mods/common` and `mods/apiserver`; all green.
- [x] 5.3 Manually trace the CLAUDE.md conventions checklist: validated-function pattern used,
      no `any`, shared types via `@qcobro/common`, no ad-hoc service imports introduced.
