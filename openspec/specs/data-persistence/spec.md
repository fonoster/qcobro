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

The database connection SHALL be supplied via a `DATABASE_URL` environment variable and SHALL NOT be hardcoded. The repository SHALL document the expected variable through an example env file.

#### Scenario: Connection read from environment

- **WHEN** the Prisma configuration resolves its connection string
- **THEN** it reads `DATABASE_URL` from the environment

#### Scenario: Example env documents the variable

- **WHEN** the repository root is inspected
- **THEN** an `.env.example` file documents `DATABASE_URL` with a PostgreSQL connection string format

### Requirement: Migration workflow

Schema changes SHALL be managed through Prisma migrations checked into the repository. The project SHALL expose scripts to generate the client, create/apply migrations in development, and deploy migrations in production.

#### Scenario: Migration scripts available

- **WHEN** `mods/apiserver/package.json` scripts are inspected
- **THEN** they include `db:generate`, `db:migrate`, and `db:migrate:deploy`

#### Scenario: Migrations are versioned

- **WHEN** a schema change is applied in development
- **THEN** a corresponding migration is written under `mods/apiserver/prisma/migrations/` and committed

### Requirement: Local database runtime

The project SHALL provide a one-command local PostgreSQL instance for development via Docker Compose, configured to match the documented `DATABASE_URL`.

#### Scenario: Compose starts PostgreSQL

- **WHEN** the developer runs the Docker Compose service for the database
- **THEN** a PostgreSQL instance starts and is reachable at the host/port used by the documented `DATABASE_URL`
