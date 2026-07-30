# Ship checkpoint — whatsapp-phone-normalization

Started: 2026-07-29
Current stage: 6 — Archive (done)

**Scope:** Close out the follow-up from PR #62 (GitHub issue #63): normalize phone numbers to
canonical E.164 at write time (CSV/account import) via a new strict/throwing validated-function
normalizer; audit SMS/voice inbound-correlation paths for the same latent phone-exact-match bug
(voice correlates by callRef, email by reply-to token, SMS has no inbound webhook — audit-only, no
code change there); and revert `loadByPhoneAndSender`'s bounded 50-row scan in
`whatsAppWebhook.ts` back to a direct, indexed/exact Prisma query now that phone is canonical.
Backend-only, no webapp UI change.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (repo has pencil.pen, not touched — backend-only
change) · Storybook: yes (mods/webapp, not touched — no components in scope) · E2E: yes
(playwright e2e/, no existing spec touches WhatsApp webhook internals or CSV phone parsing;
covered by unit tests instead, see stage 4 notes)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-- | :-------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Backend-only bug fix; OpenSpec change validated (proposal/design/tasks/specs all present).                                                                                                                                                                                                                                                                                                                                    |
| 1   | Design (Pencil) | skipped | No UI/visual change — pure backend fix (validated-function utility, import-time normalization, webhook query shape). Pre-authorized to skip per task instructions.                                                                                                                                                                                                                                                            |
| 2   | Spec reconcile  | done    | No design stage ran, so no design-driven behavior changes to reconcile. Delta specs already match proposal/design as written. `openspec validate --strict` passing.                                                                                                                                                                                                                                                           |
| 3   | Build           | done    | All 3 issue follow-up items implemented (see decision log).                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Test            | done    | Unit tests added (incl. validation-failure cases); full monorepo lint + typecheck + test all green. No e2e — backend-only, no existing e2e spec touches this surface.                                                                                                                                                                                                                                                         |
| 5   | Sync            | done    | Promoted delta specs into openspec/specs/portfolio-accounts/spec.md (MODIFIED "Account data fields": phone normalized-to-E.164 note + 2 new scenarios) and openspec/specs/whatsapp-channel/spec.md (ADDED "Inbound message correlation by canonical phone match" requirement + 2 scenarios). `openspec validate --specs --strict` passes (38/38). Pre-authorized human gate, proceeded without pausing per task instructions. |
| 6   | Archive         | done    | Moved openspec/changes/whatsapp-phone-normalization → openspec/changes/archive/2026-07-30-whatsapp-phone-normalization. Pre-authorized human gate, proceeded without pausing per task instructions. All 4 artifacts (proposal/design/specs/tasks) were done and all tasks.md checkboxes were checked before archiving.                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-30 — Build + test stages complete. Implemented: (1) `createValidatePhoneE164` validated-function (mods/common/src/schemas/phone.ts, mods/common/src/utils/validatePhone.ts) wired into `createSyncAccounts` (mods/apiserver/src/functions/portfolios/syncAccounts.ts) — normalizes every row's phone before opening the transaction, whole batch fails on first invalid phone; (2) audit of voice/email/SMS inbound correlation confirmed no other exact-match-on-phone bug exists (voice→callRef, email→reply-to token, SMS→no inbound webhook at all) — no code change for that item; (3) `loadByPhoneAndSender` in mods/apiserver/src/rest/whatsAppWebhook.ts reverted to a direct `accountContactLog.findFirst` with `channelData` JSON-path exact match + workspace scoping (PR #64 fix preserved), short-circuiting to null before querying on unparseable inbound numbers. Added unit tests: mods/common/src/utils/validatePhone.test.ts, mods/apiserver/src/functions/portfolios/syncAccounts.test.ts (new cases), mods/apiserver/src/rest/whatsAppInboundClient.test.ts (new file, exercises the reverted query shape directly). Full monorepo `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test` all green (one transient webapp build failure traced to a stale local Nx/tsbuildinfo cache, unrelated to this change — resolved with `nx reset`).
- 2026-07-29 — Design stage skipped: backend-only bug fix, no webapp UI/visual change (per task instructions, pre-authorized).
- 2026-07-29 — OpenSpec change `whatsapp-phone-normalization` created and validated (`openspec validate --strict` passed). proposal.md, design.md, tasks.md, specs/portfolio-accounts/spec.md, specs/whatsapp-channel/spec.md all written.
- 2026-07-29 — Frame stage complete; entering spec reconcile (trivial — no design stage ran, so nothing to reconcile).
