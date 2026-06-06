## Context

QCobro is being rebuilt from scratch; the prior implementation is archived on the `demo` branch and is not a constraint. The `main` branch currently retains only the marketing site and the shared tooling baseline (Prettier, ESLint, Husky, Lerna). This change establishes the application skeleton — monorepo packages, database, API layer, and web console shell — so that subsequent feature changes (domain model, auth, voice-agent integration) have stable ground.

The demo validated a stack (TypeScript monorepo, tRPC + Prisma, React + Vite, Fonoster) but accreted ad hoc and used SQLite. We are deliberately reusing the parts that worked while correcting the database choice and building spec-first.

Constraints carried in from the project definition: the product is **multilingual** (no language hardcoded), and the old "commitments/promises" entities are being generalized into "Objectives" — but the domain model itself is out of scope here.

## Goals / Non-Goals

**Goals:**

- A buildable, lint-clean monorepo with three packages: `common`, `apiserver`, `webapp`.
- PostgreSQL via Prisma, env-driven, with a one-command local runtime.
- A tRPC internal API skeleton with a typed context that exposes shared services (database now; telephony and other integrations later) and shared Zod contracts, plus a structural seam for a future public REST/OpenAPI surface.
- A React + Vite + Tailwind console shell that is i18n-ready and wired to the API with end-to-end types.
- CI that typechecks, lints, and builds the app packages without disturbing site deploys, and Conventional Commits enforced locally.

**Non-Goals:**

- The domain data model (portfolios, accounts, campaigns, Objectives) beyond the minimum needed to prove the stack compiles and connects.
- Authentication/authorization logic (only the context seam for a future `user`).
- An `agents` runtime package and any voice-agent / Fonoster behavior — deferred entirely to a later change (the agent remains a valid domain concept, just not a module yet).
- Any public REST endpoints — only the seam that makes them addable later.

## Decisions

**Monorepo with npm workspaces + Lerna under `mods/`.**
Reuses the demo's proven layout and the tooling already retained on `main`. Alternative: Nx or Turborepo for richer task orchestration — rejected for now as added complexity the project hasn't yet outgrown; Lerna already runs targets across packages.

**PostgreSQL via Prisma.**
Production-grade relational store fitting the audit/consistency needs of collections data. Alternative: keep SQLite (demo) — rejected per the rebuild mandate; SQLite is removed entirely. The Prisma datasource switches `provider` to `postgresql` and the connection comes from `DATABASE_URL`.

**tRPC primary, REST/OpenAPI as a seam.**
tRPC gives end-to-end type safety for the internal operator console with the least ceremony. Public integrations (CRM / core-banking) need a documented REST contract, so the HTTP layer mounts tRPC at a dedicated path (e.g. `/trpc`) leaving room to mount a REST/OpenAPI router beside it later. Alternative: REST-only from day one — rejected as slower for internal velocity; alternative: tRPC-only — rejected because external partners need a stable public contract.

**`common` as the single contract source.**
Domain types and Zod schemas live in `common`; both apiserver (input validation) and webapp (forms/types) import them. Prevents drift between client and server. `common` depends on no other workspace package to keep the dependency graph acyclic.

**i18n from the start.**
All console copy resolves through an i18n layer keyed by message IDs, with a configurable active language. Avoids a costly retrofit and encodes the multilingual product decision structurally rather than by convention.

**Local PostgreSQL via Docker Compose.**
A `compose` service gives every developer the same DB with one command, matching the documented `DATABASE_URL`. Alternative: rely on a hosted/dev Postgres — rejected for local-first developer experience and offline work.

**Context as a service container.**
The tRPC context is the single place procedures reach shared services. Today that is just the Prisma client, but telephony (Fonoster) and other third-party integrations will join it there rather than being constructed inside procedures. This keeps procedures injectable and testable (services can be swapped for fakes) and avoids scattering client construction. Alternative: import clients directly in each procedure — rejected as untestable and inconsistent.

**Conventional Commits, enforced by a hook.**
Commit messages follow Conventional Commits, enforced by commitlint via a Husky `commit-msg` hook so violations fail locally. This keeps history machine-readable (enabling future changelog/version automation) and consistent across contributors. Alternative: convention by documentation only — rejected as unenforced conventions drift.

## Risks / Trade-offs

- **tRPC ↔ REST seam drift** → If the public surface is deferred too long, the seam may not fit real needs. Mitigation: keep the public contract in mind when shaping `common` schemas so REST handlers can reuse them.
- **Prisma/Postgres version churn** (the demo hit Prisma 7 adapter API changes) → Pin Prisma and the client to matching versions and capture the generate/migrate flow in scripts and CI.
- **Bundle size** (the demo webapp emitted an 880 kB chunk) → Acceptable for an internal console at this stage; revisit with code-splitting when feature pages land.
- **Scope creep into the domain model** → Keep schema minimal (enough to prove connectivity); resist modeling Objectives here.

## Migration Plan

This is greenfield on `main` (no production data to migrate). Rollout:

1. Scaffold packages and shared configs; restore workspace references in root `package.json`, `lerna.json`, `tsconfig.json`.
2. Add Prisma with a PostgreSQL datasource, an initial migration, and the Docker Compose DB service; document `DATABASE_URL` in `.env.example`.
3. Stand up the tRPC apiserver skeleton (context, root router, error shape) and the typed client.
4. Scaffold the Vite/React/Tailwind shell with i18n and Storybook.
5. Add the CI workflow for app packages.

Rollback is trivial — revert the change's commits; the site and tooling on `main` are untouched. The demo branch remains the historical reference.

## Open Questions

- Redis (queues/caching for call scheduling and rate limiting) was considered for the database tier but deferred. Revisit when the voice-agent change defines its scheduling needs.
- Exact auth mechanism (session vs. token) is deferred to the auth change; the foundation only reserves a nullable `user` in context.
