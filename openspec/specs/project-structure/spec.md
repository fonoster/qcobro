# project-structure Specification

## Purpose

TBD - created by archiving change project-foundation. Update Purpose after archive.

## Requirements

### Requirement: Monorepo workspace layout

The repository SHALL be organized as a TypeScript monorepo using npm workspaces and Lerna, with all application packages under `mods/`. The foundation SHALL define exactly these packages: `common`, `apiserver`, and `webapp`.

#### Scenario: Workspaces are declared

- **WHEN** the root `package.json` is inspected
- **THEN** its `workspaces` field includes `mods/*` (and `site`)
- **AND** `lerna.json` includes `mods/*` in its `packages`

#### Scenario: Required packages exist

- **WHEN** the `mods/` directory is listed
- **THEN** it contains `common`, `apiserver`, and `webapp`, each with its own `package.json`

### Requirement: Package dependency direction

The `common` package SHALL be the shared source of domain types and Zod schemas, and SHALL NOT depend on any other workspace package. `apiserver` and `webapp` SHALL depend on `common`. There SHALL be no circular dependencies between workspace packages.

#### Scenario: Common has no internal dependencies

- **WHEN** `mods/common/package.json` dependencies are inspected
- **THEN** they include no other `@qcobro/*` workspace package

#### Scenario: Consumers depend on common

- **WHEN** `mods/apiserver/package.json` and `mods/webapp/package.json` are inspected
- **THEN** each declares a dependency on `@qcobro/common`

### Requirement: Shared tooling conventions

The monorepo SHALL share a single baseline for formatting, linting, git hooks, and TypeScript configuration. Prettier, ESLint, and Husky SHALL be configured at the repository root, and packages SHALL extend the root TypeScript configuration via project references.

#### Scenario: Root tooling present

- **WHEN** the repository root is inspected
- **THEN** `.prettierrc`, `eslint.config.mjs`, and a Husky `pre-commit` hook exist
- **AND** the root `tsconfig.json` references each buildable workspace package

#### Scenario: Lint and format run across the workspace

- **WHEN** `npm run lint` and `npm run format:check` are executed at the root
- **THEN** they evaluate files across all workspace packages without configuration errors

### Requirement: Conventional Commits

Commit messages SHALL follow the Conventional Commits specification (a `type(scope): subject` header, with types such as `feat`, `fix`, `chore`, `docs`, `refactor`, `test`). The convention SHALL be enforced automatically at commit time via a Husky `commit-msg` hook so non-conforming messages are rejected locally.

#### Scenario: Conforming commit is accepted

- **WHEN** a commit is made with a message like `feat(api): add health router`
- **THEN** the `commit-msg` hook passes and the commit succeeds

#### Scenario: Non-conforming commit is rejected

- **WHEN** a commit is made with a message that lacks a valid Conventional Commits type (e.g. `updated stuff`)
- **THEN** the `commit-msg` hook fails and the commit is blocked

### Requirement: Continuous integration for app packages

The repository SHALL run automated CI checks for the application packages on push and pull request, covering typecheck, lint, and build. The CI SHALL NOT interfere with the existing site deployment workflow.

#### Scenario: CI workflow verifies app packages

- **WHEN** a commit affecting `mods/**` is pushed
- **THEN** a CI workflow runs typecheck, lint, and build for the app packages
- **AND** the workflow fails if any of those steps fail

#### Scenario: Site deploy remains independent

- **WHEN** the CI configuration is inspected
- **THEN** the site deploy workflow is triggered only by changes under `site/**`
