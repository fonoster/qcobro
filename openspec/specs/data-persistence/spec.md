# data-persistence Specification

## Purpose

TBD - created by archiving change project-foundation. Update Purpose after archive.

## Requirements

### Requirement: PostgreSQL as the database

The system SHALL use PostgreSQL as its only database, accessed through Prisma. SQLite SHALL NOT be used anywhere in the project.

#### Scenario: Prisma datasource targets PostgreSQL

- **WHEN** `mods/apiserver/prisma/schema.prisma` is inspected
- **THEN** its `datasource` block declares `provider = "postgresql"`

#### Scenario: No SQLite references remain

- **WHEN** the repository is searched for SQLite usage (e.g. `provider = "sqlite"`, `better-sqlite3`, `.db` files)
- **THEN** no such references exist in tracked source or configuration

### Requirement: Environment-driven connection

The database connection SHALL be sourced from `qcobro.json` (the single configuration
source of truth) and SHALL NOT be hardcoded. The runtime Prisma client SHALL be
constructed with the connection URL read from `qcobro.json`. The Prisma CLI, which reads
`DATABASE_URL` from the environment, SHALL receive it injected from `qcobro.json` by the
repository's wrapper (`mods/apiserver/scripts/prisma.mjs`) — used by the `db:*` scripts
and the apiserver build. No root `.env`/`.env.example` is required for the apiserver.

#### Scenario: Runtime connection read from qcobro.json

- **WHEN** the apiserver constructs its Prisma client
- **THEN** the connection URL is taken from `qcobro.json` (`database.url`), not from a
  `DATABASE_URL` environment variable

#### Scenario: Prisma CLI connection injected from qcobro.json

- **WHEN** a `db:*` script or the apiserver build invokes the Prisma CLI (generate/migrate)
- **THEN** `DATABASE_URL` is provided to the CLI from `qcobro.json` by `scripts/prisma.mjs`
- **AND** the repository root does not require an `.env`/`.env.example` file for this to work

### Requirement: Migration workflow

Schema changes SHALL be managed through Prisma migrations checked into the repository. The project SHALL expose scripts to generate the client, create/apply migrations in development, and deploy migrations in production.

#### Scenario: Migration scripts available

- **WHEN** `mods/apiserver/package.json` scripts are inspected
- **THEN** they include `db:generate`, `db:migrate`, and `db:migrate:deploy`

#### Scenario: Migrations are versioned

- **WHEN** a schema change is applied in development
- **THEN** a corresponding migration is written under `mods/apiserver/prisma/migrations/` and committed

### Requirement: Local database runtime

The project SHALL provide a one-command local PostgreSQL instance for development via Docker Compose, configured to match the database URL in `qcobro.json`.

#### Scenario: Compose starts PostgreSQL

- **WHEN** the developer runs the Docker Compose service for the database
- **THEN** a PostgreSQL instance starts and is reachable at the host/port used by the `database.url` in `qcobro.json`
