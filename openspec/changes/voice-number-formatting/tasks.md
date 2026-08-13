## 1. Workspace locale setting (contracts + persistence)

- [x] 1.1 Add `DEFAULT_LOCALE = "es-DO"` and a `supportedLocales` list (es-DO only) to
      `@qcobro/common`, with a `localeSchema` validating against it
- [x] 1.2 Extend `workspaceSettingsSchema` in `mods/common/src/schemas/workspaceSettings.ts`
      with `locale` — leave `updateWorkspaceSettingsSchema` untouched, the locale is not
      operator-editable
- [x] 1.3 Add `locale` to the Prisma `WorkspaceSettings` model with a column default equal to
      `DEFAULT_LOCALE`, and generate the migration
- [x] 1.4 Include `locale` in the settings seed-on-read default path so every workspace resolves
      a locale without a data backfill
- [x] 1.5 Unit test: a settings record with an unsupported locale is rejected with a structured
      validation error and nothing is persisted

## 2. Locale-aware number utilities (`@qcobro/common`)

- [x] 2.1 Add `formatMoney(value, locale)` — grouping separators, two fraction digits only when
      the amount has a fractional part
- [x] 2.2 Add `toNumber(value, locale)` — discovers `group`/`decimal` separators via
      `Intl.NumberFormat(locale).formatToParts`, normalizes, then `Number()`; returns `NaN` for
      unparseable input
- [x] 2.3 Unit test both against es-DO (comma grouping) and, to prove the separator discovery is
      real rather than hardcoded, es-ES (period grouping) — including the round trip
      `toNumber(formatMoney(x)) === x`

## 3. Render context and helpers (`mods/common/src/utils/outreach.ts`)

- [x] 3.1 Change `buildOutreachContext(account, { currency })` to take `{ currency, locale }` and
      emit `outstandingBalance`, `principalAmount`, `termsAmount`, `lastPaymentAmount` via
      `formatMoney`; leave `daysPastDue`, `missedInstallments`, `termsLength` numeric
- [x] 3.2 Route `multiply`, `eq`, `gt`, `gte`/`ge`, `lt`, `lte` operands through `toNumber`,
      preserving today's fallbacks (`multiply` → `0`, comparisons → false)
- [x] 3.3 Format `multiply`'s result with `formatMoney`
- [x] 3.4 Register the `digits` helper — strip non-digits, join with single spaces, empty for a
      missing value
- [x] 3.5 Update `buildAutopilotContextLines` so its `typeof value === "number"` guards still
      match the now-string money fields
- [x] 3.6 Unit tests: money fields formatted per locale; counts unformatted;
      `{{multiply outstandingBalance 0.5}}` renders `4,750` for a 9500 balance;
      `{{#if (gte outstandingBalance 1000)}}` true; `{{digits phone}}` spells digits and drops
      formatting characters; a validation-failure case asserting a bad locale is rejected before
      any formatting runs
- [x] 3.7 Unit test: `buildAutopilotContextLines` emits the full line set for a fully-populated
      account

## 4. Thread the locale to every call site

- [x] 4.1 Campaigns engine (`mods/apiserver/src/engine/engine.ts`)
- [x] 4.2 Outreach router (`mods/apiserver/src/trpc/routers/outreach.ts`)
- [x] 4.3 Agent evaluations (`buildSyntheticAccount.ts`)
- [x] 4.4 Voice outcome (`decideVoiceOutcome.ts`) and the WhatsApp / email inbound paths
- [x] 4.5 Confirm the tRPC context exposes the workspace locale alongside `currency` so no call
      site reads settings ad hoc

## 5. Console

- [x] 5.1 Pass the workspace locale into `buildOutreachContext` in `ReachOutModal.tsx` so the
      live preview matches what is dispatched
- [x] 5.2 No settings UI in this change (single supported locale) — and no Storybook story,
      since no component changes

## 6. Tests and docs

- [ ] 6.1 E2E: open the reach-out modal for an account with a known balance and assert the
      preview shows the amount grouped (`9,500`), covering the preview/send parity risk —
      **written** (extends `e2e/manual-outreach.spec.ts`, also asserts `{{digits phone}}`) but
      **not executed**: needs a running dev stack, and the apiserver cannot boot without
      `config/qcobro.json`, which is git-ignored and absent on this machine
- [x] 6.2 Update `docs-site/guides/agent-templates.mdx`: amounts are formatted automatically,
      the `digits` helper, that a number typed literally into a script is not rewritten, and
      that helpers do not work on the WhatsApp channel
- [x] 6.3 Run lint, typecheck and the full test suite green — common 167/167, apiserver
      310/312 (the 2 failures are the same missing-`config/qcobro.json` env issue, present on
      `main`); eslint clean; typecheck clean for common/apiserver/webapp
