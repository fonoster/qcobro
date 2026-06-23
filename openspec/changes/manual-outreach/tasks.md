## 1. Pencil — Design

- [ ] 1.1 Design "Contactar manualmente" action in the portfolio accounts row ⋯ menu
- [ ] 1.2 Design the manual-outreach modal (agent template select, optional campaign
      adjudication, rendered body preview, send) over the dimmed Cartera page

## 2. Common — config, ports, schemas, templating

- [ ] 2.1 Add `fonoster.numbers` (E.164) + `twilio` block (accountSid, authToken, fromNumbers) to config schema
- [ ] 2.2 Add `OutboundCallClient` and `SmsClient` ports
- [ ] 2.3 Add `dispatchOutreachSchema` input + `DispatchResult` type
- [ ] 2.4 Add Handlebars `renderTemplate` + `buildOutreachContext(account, portfolio)` (dep: handlebars)
- [ ] 2.5 Add `pickNumber` selector (default random, injectable)

## 3. API Server — adapters + dispatch functions

- [ ] 3.1 `FonosterOutboundCallClient` adapter (@fonoster/sdk `Calls`, 15s timeout)
- [ ] 3.2 `TwilioSmsClient` adapter (dep: twilio)
- [ ] 3.3 `dispatchOutreach` + `dispatchVoiceCall` + `dispatchSms` validated functions
- [ ] 3.4 Wire clients + number pools into the tRPC context
- [ ] 3.5 `outreach.dispatch` tRPC procedure (load account/template/portfolio, dispatch, record gestión)

## 4. Webapp — manual outreach modal

- [ ] 4.1 "Contactar manualmente" row action in the portfolio accounts view
- [ ] 4.2 Manual-outreach modal: template select, campaign adjudication, rendered preview, send
- [ ] 4.3 i18n keys (en/es)

## 5. Tests

- [ ] 5.1 Unit: `renderTemplate` / context (incl. missing field renders empty)
- [ ] 5.2 Unit: `dispatchOutreach` voice + SMS happy paths (stubbed clients)
- [ ] 5.3 Unit: validation-failure + unconfigured-channel + empty-pool error cases (no provider call fired)
- [ ] 5.4 E2E: open a Cartera, "Contactar manualmente", send an SMS, verify confirmation
