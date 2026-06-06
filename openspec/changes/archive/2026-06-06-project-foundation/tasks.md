## 1. Monorepo scaffolding

- [x] 1.1 Restore `mods/*` in root `package.json` `workspaces` and `lerna.json` `packages`
- [x] 1.2 Re-add workspace orchestration scripts to root `package.json` (`build`, `clean`, `test`, `typecheck`, and start scripts)
- [x] 1.3 Add TypeScript project references for `common` and `apiserver` to the root `tsconfig.json`
- [x] 1.4 Create the three package directories under `mods/` (`common`, `apiserver`, `webapp`), each with a `package.json` and `tsconfig.json`
- [x] 1.5 Verify `npm install`, `npm run lint`, and `npm run format:check` succeed across the workspace

## 2. Shared contracts package (common)

- [x] 2.1 Set up `@qcobro/common` with a build that emits types and an entry index
- [x] 2.2 Add Zod as a dependency and export a placeholder schema + inferred type to prove the contract pattern
- [x] 2.3 Confirm `common` declares no `@qcobro/*` dependencies (acyclic graph)

## 3. Data persistence (PostgreSQL + Prisma)

- [x] 3.1 Add Prisma and `@prisma/client` to `apiserver`; set the datasource `provider` to `postgresql`
- [x] 3.2 Configure the connection from `DATABASE_URL`; document it in a root `.env.example`
- [x] 3.3 Add a Docker Compose service for local PostgreSQL matching the documented `DATABASE_URL`
- [x] 3.4 Define a minimal initial schema (enough to prove connectivity) and generate the first migration under `prisma/migrations/`
- [x] 3.5 Add `db:generate`, `db:migrate`, and `db:migrate:deploy` scripts to `apiserver`
- [x] 3.6 Verify no SQLite references remain anywhere in tracked files (`sqlite`, `better-sqlite3`, `*.db`)

## 4. API foundation (tRPC)

- [x] 4.1 Create the tRPC context exposing shared services (the Prisma client, with room for telephony/third-party clients) and a nullable `user`
- [x] 4.2 Define the base tRPC instance with the typed error shape
- [x] 4.3 Compose a root router from feature routers and export the `AppRouter` type
- [x] 4.4 Add an example procedure whose input is validated by a Zod schema from `@qcobro/common`
- [x] 4.5 Mount the tRPC handler at a dedicated path (e.g. `/trpc`), leaving room for a future REST/OpenAPI surface
- [x] 4.6 Verify the apiserver builds and starts against the local PostgreSQL instance

## 5. Web console shell (React + Vite)

- [x] 5.1 Scaffold `@qcobro/webapp` with Vite + React + Tailwind CSS
- [x] 5.2 Add the application shell with client-side routing and a default route
- [x] 5.3 Wire a tRPC client typed against the apiserver `AppRouter`
- [x] 5.4 Add an i18n layer; render all shell copy via message IDs with a configurable active language
- [x] 5.5 Set up Storybook and add at least one component story
- [x] 5.6 Verify `npm run build` and the Storybook build both succeed

## 6. Continuous integration

- [x] 6.1 Add a CI workflow that runs typecheck, lint, and build for app packages on push/PR affecting `mods/**`
- [x] 6.2 Confirm the site deploy workflow triggers only on `site/**` changes
- [x] 6.3 Verify the full pipeline passes end to end (`typecheck`, `lint`, `build`)

## 7. Conventional Commits

- [x] 7.1 Add commitlint (`@commitlint/cli` + `@commitlint/config-conventional`) and a `commitlint.config` at the repository root
- [x] 7.2 Add a Husky `commit-msg` hook that runs commitlint
- [x] 7.3 Verify a conforming message passes and a non-conforming message is rejected
