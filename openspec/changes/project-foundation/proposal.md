## Why

QCobro is being rebuilt from scratch (the prior implementation is archived on the `demo` branch). Before any product feature is built, the project needs a clean, explicitly specified foundation: a monorepo layout, a real database, an API layer, and a web console shell — all spec-driven from day one so later changes have stable ground to stand on.

## What Changes

- Establish a TypeScript monorepo (npm workspaces + Lerna) with clear package boundaries:
  - `common` — shared types and Zod schemas (single source of truth for domain contracts)
  - `apiserver` — backend API and access to shared services (database today; telephony and other integrations later)
  - `webapp` — operator web console
- Adopt **PostgreSQL** as the database via Prisma. **BREAKING** relative to the demo: SQLite is removed entirely.
- Establish **tRPC** as the primary internal API, with a typed context that exposes shared services to procedures and structure prepared to expose **REST/OpenAPI** for public-facing APIs later.
- Stand up the **React + Vite + Tailwind** web console shell with Storybook, built **i18n-ready** (no hardcoded language; language is configurable per the project definition).
- Wire the developer workflow: local PostgreSQL via Docker Compose, env-driven configuration, CI checks (typecheck, lint, build) for the app packages, and **Conventional Commits** enforced by a Husky `commit-msg` hook.
- Reuse the already-retained tooling baseline: Prettier, ESLint, Husky, Lerna.

## Capabilities

### New Capabilities

- `project-structure`: Monorepo workspace layout, package boundaries and dependency direction, shared TypeScript/tooling conventions, and CI verification of the app packages.
- `data-persistence`: PostgreSQL via Prisma — schema/migration conventions, env-driven connection, and a local database runtime (Docker Compose).
- `api-foundation`: tRPC as the primary internal API (typed context, router composition, error handling) with a defined seam for adding REST/OpenAPI public endpoints.
- `web-console`: React + Vite + Tailwind console shell — app bootstrap, routing, API client wiring, i18n-ready text handling, and Storybook for components.

### Modified Capabilities

<!-- None — no existing specs yet; this is the first change. -->

## Impact

- **Repo:** introduces `mods/common`, `mods/apiserver`, `mods/webapp`; root `package.json`, `lerna.json`, `tsconfig.json` regain workspace references.
- **Dependencies:** Prisma + `@prisma/client`, PostgreSQL driver, tRPC, React, Vite, Tailwind, Storybook, Zod, commitlint.
- **Infrastructure:** Docker Compose for local PostgreSQL; `.env` configuration; GitHub Actions CI for app packages (the site deploy workflow is unaffected).
- **Out of scope (deferred):** the domain model (portfolios, accounts, campaigns, agents, Objectives), authentication, an `agents` runtime package, and the voice-agent/Fonoster behavior — each its own later change.
