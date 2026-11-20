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
one change through design (Nib), spec reconcile, build (Storybook first), tests, sync and
archive. The previous implementation is archived on the `demo` branch.

## Commands

- The dev container is the only supported environment: Docker plus VS Code Dev Containers or
  `npx @devcontainers/cli`. Opening it writes `.dev/` (keys, `qcobro.json`, secrets;
  git-ignored) and installs, migrates and seeds. Every command below, and `git commit`, runs
  inside it.
- Build, typecheck, lint: `npm run build`, `npm run typecheck`, `npm run lint`.
- Unit tests: `npm test`, or one package with `npm test --workspace=mods/<pkg>`.
- E2E: `bash .devcontainer/ci-e2e.sh` in the container starts the API and the console, then
  runs `npm run test:e2e` (Playwright), as CI's `e2e` job does.
- Run: `npm run start:dev` (API on :3000), `npm run start:webapp` (console on :5173),
  `npm run storybook`.
- Default Verify, through `npx @devcontainers/cli exec --workspace-folder <checkout>`:
  `npm run typecheck && npm test --workspace=mods/<pkg>` for the package touched; add
  `bash .devcontainer/ci-e2e.sh` for `area: console`.

## Conventions

Profile: typescript
Overrides:

- Schemas and client interfaces live in `@qcobro/common` (`src/schemas/`, `src/types/`). Don't
  duplicate types between apiserver and webapp.
- Procedures reach services (DB, telephony, providers) through the tRPC context, never through
  imports inside a procedure.
- Configuration is a mounted, Zod-validated `qcobro.json`, not env vars;
  `config/qcobro.example.json` is the committed example. Zod strips unknown keys, so a renamed field
  fails silently: check scripts and seeds outside `src/`, and verify against the database.
- All console text goes through `mods/webapp/src/lib/i18n.tsx`. There is no default language.
- Form fields are a label, the control, and an error only while something is wrong; the field
  components have no `hint` prop. Give every non-obvious input an example as its `placeholder`,
  without an `Ej.: ` / `E.g. ` prefix, and without restating the label. Show a `{{variable}}`
  only in a field whose text is actually template-rendered. State validation rules in the label
  (`Tiempo de inactividad (ms, mín. 3000)`, `Correo · no editable`), never only in an example.
- Every color is a token. In dark mode, green is only for the primary CTA, real positive status
  and progress (the active nav item is neutral).
- UI work is design-first: check or update the design before writing UI code. Designs are
  `.pen` files in `designs/`, edited with Nib: `dashboard-fonoster.pen` (console, importing
  `fonoster.lib.pen`), `website.pen` (`site/`), `docs.pen` (docs diagrams and assets),
  `sales.pen` (decks, one-pagers, banners). The others import `qcobro.lib.pen` as `ui` (tokens
  `$ui:<name>`, components `ui:<id>`); change shared tokens and components only in the library.
  Open the worktree's own copy by absolute path; images go in `designs/assets/`.
- Commits use Conventional Commits (`type(scope): subject`); a Husky `commit-msg` hook runs
  commitlint. No AI attribution lines on commits, PRs or issues; keep the DCO sign-off.
- Start every change in its own worktree (`git worktree add ../qcobro-<n> -b <branch>`) and
  open it in its own dev container: `npx @devcontainers/cli up --workspace-folder ../qcobro-<n>`,
  then run every command with
  `npx @devcontainers/cli exec --workspace-folder ../qcobro-<n> <command>`. Each worktree has
  its own stack, database, `.dev/` and `node_modules`; commit inside the container so the Git
  hooks run. Once it merges, run `docker compose -p qcobro-qcobro-<n> down -v`, remove the
  worktree and the branch (`git branch -D` after a squash merge) and `git fetch --prune`.

## Areas

| Area label     | Paths                                                                                                                                                           | Experts                                               |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| area: engine   | `mods/apiserver/src/engine`, `mods/apiserver/src/functions/{campaigns,outreach}`                                                                                | software-architect, performance-engineer, qa-engineer |
| area: voice    | `mods/apiserver/src/voice`, `mods/apiserver/src/services/{fonoster*,voiceAutopilot.ts}`, `mods/apiserver/src/functions/{voice,agentTemplates,agentEvaluations}` | realtime-comms-engineer, qa-engineer                  |
| area: channels | `mods/apiserver/src/rest`, `mods/apiserver/src/services/{twilio,resend,metaWhatsApp}*`, `mods/apiserver/src/functions/{email,whatsApp}`                         | security-engineer, qa-engineer                        |
| area: billing  | `mods/apiserver/src/functions/billing`, `mods/common/src/billing`, `mods/apiserver/src/rest/stripeWebhook.ts`                                                   | security-engineer, database-engineer                  |
| area: api      | `mods/apiserver/src/trpc`, `mods/apiserver/prisma`, `mods/common`                                                                                               | software-architect, database-engineer                 |
| area: console  | `mods/webapp`, `designs/`                                                                                                                                       | ux-designer, visual-designer                          |
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
- Recuperado comes from `Recovery` rows the sync records (installments × termsAmount), read
  through `recovery.summary`.

## Decisions

- 2026-06-06: Authentication, authorization and tenancy use Fonoster Identity as a gRPC service.
- 2026-06-27: Outcomes are a universal record; PaymentPromise is the only tracked entity, an
  operator worklist with no automation, marked met by the sync when the episode closes CAUGHT_UP
  or PAID_OFF (2026-11-17).
- 2026-06-27: Ad-hoc outreach dispatches an agent template with `campaignId: null`.
- 2026-06-28: Currency and timezone are per-workspace settings, not deployment config.
- 2026-07-14: WhatsApp uses the Meta Cloud API directly; QCobro's camelCase context maps to
  Meta's snake_case named parameters.
- 2026-08-21: Contact rate is account-level within a window (7 days by default); attempt-level
  was rejected (#110).
- 2026-08-31: Camino has no "Entregado" stage; for VOICE_PRERECORDED, ENGAGED is labeled "Recibido".
- A person/contact identity (normalized phone and email) is deferred, out of campaigns-engine v1
  (`docs/design-notes/contact-identity.md`).
