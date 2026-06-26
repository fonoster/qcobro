## 1. Config & contracts (@qcobro/common)

- [x] 1.1 Add a `resend` block to `qcobroConfigSchema`: `{ apiKey, fromEmail, fromName?, inboundDomain, inboundSigningSecret, maxEmailsPerMinute (default), maxRepliesDefault (default) }`; optional/inert when absent. Document in `qcobro-prod.json` example _(schema done; example doc pending in task 9.1)_
- [x] 1.2 Add `EMAIL` to `dispatchChannelSchema` and the dispatch request fields (`subject`); require subject+body for EMAIL in the superRefine
- [x] 1.3 Extend the EMAIL agent template schema: add required `systemPrompt`, optional `maxReplies`
- [x] 1.4 Define email-thread + autopilot-decision types (thread message, decision `{action, replyBody?, outcome?, objective?}`) and an `EmailClient` interface (send + the inbound payload shape) for injection/emulation
- [x] 1.5 Rebuild `@qcobro/common` (`tsc -b`) — common builds; apiserver typechecks green (regenerated stale Prisma client)

## 2. Data model (Prisma)

- [x] 2.1 Add `EmailConfig.systemPrompt` (String) and optional `EmailConfig.maxReplies` (Int)
- [x] 2.2 Email thread + reply count stored in the gestión `channelData` (no new table); correlate by `providerRef`. **Also added `PortfolioAccount.email`** (EMAIL needs the recipient address)
- [x] 2.3 Generate + apply migrations (`email_autopilot_config`, `account_email`); `db:generate`

## 3. Agent templates (EMAIL autopilot config)

- [x] 3.1 Update `createAgentTemplate` EMAIL branch to persist `systemPrompt` + `maxReplies`
- [x] 3.2 Surface EMAIL config (incl. systemPrompt) for dispatch (engine `prismaEngineClient` loads `emailConfig`)

## 4. Outbound dispatch (Resend)

- [x] 4.1 Add a `ResendEmailClient` service (REST, no SDK) implementing `EmailClient.sendEmail` (sets per-attempt reply-to token); `EmulatedEmailClient` (test-support, "emulator")
- [x] 4.2 Add the `EMAIL` branch to `dispatchOutreach`: render subject+body, send via injected client, return `providerRef` = token
- [x] 4.3 Wire the email client + `emailFrom` into the tRPC context + engine from the `resend` config (null when absent)

## 5. Inbound webhook + autopilot (`ingestEmailReply`)

- [ ] 5.1 Add `POST /api/email/inbound`: verify Resend signature; reject unverified
- [ ] 5.2 Correlate by reply-to token (`providerRef`), fallback `References`/`In-Reply-To`; reject uncorrelated without mutation
- [ ] 5.3 Append the inbound message to the gestión email thread; detect auto-replies (`Auto-Submitted`/`Precedence: bulk`) → `ignore`, do not count
- [ ] 5.4 Run the autopilot decision step (systemPrompt + thread + account context) → `{action, replyBody?, outcome?, objective?}`; reuse the insight path for outcome/Objective (never downgrade; idempotent on re-delivery)
- [ ] 5.5 Enforce the reply cap (`min(agent.maxReplies, config default)`): at/over cap → constrain to ignore/resolve/escalate
- [ ] 5.6 On `reply`: generate + send via the email client and append to the thread, incrementing the reply count

## 6. Engine integration

- [x] 6.1 Add `EMAIL` to `EngineChannel`/`channelOf`; readiness passes when `resend` configured, else `channel_not_configured`. Funnel made channel-aware (EMAIL requires `email` → `no_email`, else `no_phone`)
- [x] 6.2 Add an `email` token bucket sized from `resend.maxEmailsPerMinute`; route EMAIL dispatch through it; include EMAIL in `channelUsage`
- [x] 6.3 `buildRequest` EMAIL branch (subject + body from the EMAIL config; recipient = account email)

## 7. Webapp

- [ ] 7.1 EMAIL agent form: add the **System prompt** field + **reply cap** (i18n), per the Pencil design
- [ ] 7.2 Gestión detail: render the email **thread** (inbound + autopilot replies) + outcome + reply-count, per the Pencil design

## 8. Tests

- [ ] 8.1 Unit: `dispatchOutreach` EMAIL branch (success + validation-failure asserting structured error and no send)
- [ ] 8.2 Unit: `ingestEmailReply` — correlation, autopilot decision (reply/ignore/resolve/escalate), reply-cap enforcement, outcome never-downgrade + idempotent Objective, auto-reply detection (validation-failure case for uncorrelated/unverified)
- [ ] 8.3 Integration: EMAIL campaign dispatches via the engine with the email emulator; inbound reply drives a capped autopilot exchange; assert one gestión + thread + at-most-once
- [ ] 8.4 `lint`, `typecheck`, full `test` green

## 9. Config & seed

- [ ] 9.1 Document the `resend` block + the inbound webhook URL/signing in the README/deploy guide
- [ ] 9.2 Update the seed: give the EMAIL showcase agent a `systemPrompt` so EMAIL is dispatchable (no longer `channel_not_supported`) when `resend` is configured
