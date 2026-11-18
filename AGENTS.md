# AGENTS.md

## Overview

QCobro (by Fonoster) is a hosted, multilingual debt-collections platform that reaches people
through AI voice, SMS, email and WhatsApp. Operators use a React console (`mods/webapp`) backed
by a tRPC API over PostgreSQL (`mods/apiserver`); integrators use the published `@qcobro/sdk`,
`@qcobro/ctl` and `@qcobro/mcp`. `mods/common` holds the shared types and Zod schemas and
depends on no other workspace package. `site/` is the hand-authored marketing site (ESLint and
Prettier ignore it); `docs-site/` is the Mintlify docs, with its own `AGENTS.md`.

Product behavior is specified first with OpenSpec: specs in `openspec/specs/`, changes in
`openspec/changes/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`). `/ps:ship <change>` drives
one change through design (Pencil), spec reconcile, build (Storybook first), tests, sync and
archive. The previous implementation is archived on the `demo` branch.

## Commands

- Install: `npm ci`. Backing services: `docker compose -f compose.dev.yaml up -d`.
- Config: `cp config/qcobro.example.json config/qcobro.json`, then set `database.url`.
- Database: `npm run db:generate`, `npm run db:migrate`, `npm run db:seed --workspace=mods/apiserver`.
- Build, typecheck, lint: `npm run build`, `npm run typecheck`, `npm run lint`.
- Unit tests: `npm test`, or one package with `npm test --workspace=mods/<pkg>`.
- E2E: `npm run test:e2e` (Playwright, needs the compose stack).
- Run: `npm run start:dev` (API on :3000), `npm run start:webapp` (console on :5173),
  `npm run storybook`.
- In a worktree, use `--workspace` scripts: `lerna` resolves to the main checkout. A worktree
  needs its own `npm install` and its own `config/` files.
- Default Verify: `npm run typecheck && npm test --workspace=mods/<pkg>` for the package
  touched; add `npm run test:e2e` for `area: console`.

## Conventions

Profile: typescript
Overrides:

- Schemas and client interfaces live in `@qcobro/common` (`src/schemas/`, `src/types/`). Don't
  duplicate types between apiserver and webapp.
- Procedures reach services (DB, telephony, providers) through the tRPC context, never through
  imports inside a procedure.
- Configuration is a mounted, Zod-validated `qcobro.json`, not env vars;
  `config/qcobro-prod.json` is the committed example. Zod strips unknown keys, so a renamed field
  fails silently: check scripts and seeds outside `src/`, and verify against the database.
- All console text goes through `mods/webapp/src/lib/i18n.tsx`. There is no default language.
- Form fields are a label, the control, and an error only while something is wrong; the field
  components have no `hint` prop. Give every non-obvious input an example as its `placeholder`,
  without an `Ej.: ` / `E.g. ` prefix, and without restating the label. Show a `{{variable}}`
  only in a field whose text is actually template-rendered. State validation rules in the label
  (`Tiempo de inactividad (ms, mín. 3000)`, `Correo · no editable`), never only in an example.
- Every color is a token. In dark mode, green is only for the primary CTA, the active nav item,
  real positive status and progress.
- UI work is design-first: check or update `pencil.pen` before writing UI code. The Pencil MCP
  writes to the file Pen.app has open (the main checkout), not the worktree's copy; move the
  change into the branch.
- Commits use Conventional Commits (`type(scope): subject`); a Husky `commit-msg` hook runs
  commitlint. No AI attribution lines on commits, PRs or issues; keep the DCO sign-off.
- Start every change in its own worktree. Once it merges, remove the worktree and the branch
  (`git branch -D` after a squash merge) and `git fetch --prune`.

## Areas

| Area label     | Paths                                                                                                                                                           | Experts                                               |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| area: engine   | `mods/apiserver/src/engine`, `mods/apiserver/src/functions/{campaigns,outreach}`                                                                                | software-architect, performance-engineer, qa-engineer |
| area: voice    | `mods/apiserver/src/voice`, `mods/apiserver/src/services/{fonoster*,voiceAutopilot.ts}`, `mods/apiserver/src/functions/{voice,agentTemplates,agentEvaluations}` | realtime-comms-engineer, qa-engineer                  |
| area: channels | `mods/apiserver/src/rest`, `mods/apiserver/src/services/{twilio,resend,metaWhatsApp}*`, `mods/apiserver/src/functions/{email,whatsApp}`                         | security-engineer, qa-engineer                        |
| area: billing  | `mods/apiserver/src/functions/billing`, `mods/common/src/billing`, `mods/apiserver/src/rest/stripeWebhook.ts`                                                   | security-engineer, database-engineer                  |
| area: api      | `mods/apiserver/src/trpc`, `mods/apiserver/prisma`, `mods/common`                                                                                               | software-architect, database-engineer                 |
| area: console  | `mods/webapp`, `pencil.pen`                                                                                                                                     | ux-designer, visual-designer                          |
| area: sdk      | `mods/sdk`, `mods/ctl`, `mods/mcp`                                                                                                                              | release-engineer, technical-writer                    |
| area: docs     | `docs-site`, `site`                                                                                                                                             | technical-writer                                      |
| area: release  | `.github/workflows`, `Dockerfile`, `compose*.yaml`, `config/`                                                                                                   | release-engineer, security-engineer                   |

## Compatibility

Breaking changes are:

- The public API of `@qcobro/sdk`, the commands and flags of `@qcobro/ctl`, and the tool names
  and inputs of `@qcobro/mcp`. `@qcobro/common` is published but internal: it may change when
  its dependents change in the same PR.
- tRPC procedures: integrators call them directly through `client.trpc`.
- REST: `/api/contact-logs` (workspace-scoped Basic auth), and the provider webhook receivers
  `/api/{voice,sms,engine}/events`, `/api/email/inbound`, `/api/whatsapp/webhook`,
  `/api/stripe/webhook`.
- The `qcobro.json` schema (`mods/common/src/config.ts`) and the startup env vars
  `QCOBRO_CONFIG`, `DATABASE_URL` and `QCOBRO_API_SECRET`.
- The Prisma schema: a migration must apply cleanly to production data.

## Risk hotspots

- `mods/apiserver/src/engine/`: dials and messages real people; a mistake costs money and
  breaks contact limits.
- `mods/apiserver/src/services/fonoster*`, `src/functions/voice/`, `src/voice/`: provider
  integration, and the most fix commits after the console pages.
- `mods/apiserver/src/functions/billing/`, `src/rest/{stripeWebhook,svixSignature,basicAuth}.ts`:
  money and signature checks.
- `mods/apiserver/src/trpc/context.ts` and the Identity client: authentication and tenancy.
- `mods/apiserver/prisma/`: production migrations.
- `mods/common/src/config.ts`: unknown keys are stripped silently.
- `.github/workflows/{release,deploy,docker-publish,sdk-publish}.yml`.

## Release

Every merge to `main` that passes CI runs `release.yml`: `lerna version --conventional-commits`
bumps one shared version for all packages and tags `vX.Y.Z`. The tag triggers
`docker-publish.yml` (apiserver and webapp images) and `sdk-publish.yml` (npm), then `deploy.yml`
deploys over SSH to the DigitalOcean droplet with Docker Compose.

- Merge one PR at a time: each merge is a release.
- Don't add `[skip ci]` to release commits or move the job guards to `create` events: #52 and #55
  broke publishing and deploys, and #56 restored the current config.

## Expert notes

### realtime-comms-engineer

- Voice runs on Fonoster: outbound calls use `@fonoster/sdk` `Calls`, and voice agent templates
  sync to Fonoster AUTOPILOT applications.
- Call results arrive by Fonoster's signed workspace webhooks at `POST /api/voice/events`
  (`call.ended`, `call.failed`, `call_record.sealed`, secret in `fonoster.webhookSecret`); the
  Voz IA transcript and the recording come from the call record. The completion sweep is only
  a backstop: at 0.63 `GetCall` is NOT_FOUND until the record is sealed at hangup.
- Barge-in is a per-template setting (`allowUserBargeIn`), off by default.

### security-engineer

- Inbound webhooks verify the provider's signature (Svix for Resend, Stripe, Meta).
- WhatsApp credentials are per-workspace tenant secrets.

### technical-writer

- `docs-site/AGENTS.md` sets the docs editorial policy: Spanish prose, hosted product only, no
  internal names.

### database-engineer

- `intentStatus` is a Prisma enum.
- The recovered amount is a manual PaymentPromise counter, not a balance diff.

## Decisions

- 2026-06-06: Authentication, authorization and tenancy use Fonoster Identity as a gRPC service.
- 2026-06-27: Outcomes are a universal record; PaymentPromise is the only tracked entity, an
  operator worklist with no automation, marked paid by hand.
- 2026-06-27: Ad-hoc outreach dispatches an agent template with `campaignId: null`.
- 2026-06-28: Currency and timezone are per-workspace settings, not deployment config.
- 2026-07-14: WhatsApp uses the Meta Cloud API directly; QCobro's camelCase context maps to
  Meta's snake_case named parameters.
- 2026-08-21: Contact rate is account-level within a window (7 days by default); attempt-level
  was rejected (#110).
- 2026-08-31: Camino has no "Entregado" stage; for VOICE_PRERECORDED, ENGAGED is labeled "Recibido".
- A person/contact identity (normalized phone and email) is deferred, out of campaigns-engine v1
  (`docs/design-notes/contact-identity.md`).
