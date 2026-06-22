# QCobro — Agent Guide

QCobro (by Fonoster) is a **multilingual** AI-voice debt-collections platform. It is being
rebuilt spec-first with OpenSpec. The previous implementation is archived on the `demo` branch.

## How work is organized

- **Product behavior (the WHAT)** lives in OpenSpec specs under `openspec/specs/`, and is changed
  through proposals in `openspec/changes/`. Use `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.
  Specs describe observable, testable behavior — not coding style.
- **Shipping a change (the LOOP)** drives one change from design to archive with
  `/ps:ship <change>`: design (Pencil) → spec reconcile → build (Storybook-first) → tests
  (unit + e2e) → sync → archive, resumable via a per-change checkpoint.
- **Coding conventions (the HOW)** live in this file. They apply to every change.

## Repository layout

- `mods/common` — shared types and Zod schemas; the single source of truth for contracts.
  Depends on no other workspace package.
- `mods/apiserver` — tRPC API over Prisma/PostgreSQL. Procedures reach shared services
  (DB today; telephony and other integrations later) through the tRPC **context**.
- `mods/webapp` — React + Vite + Tailwind operator console; i18n-ready.
- `site` — marketing site (hand-authored; ESLint/Prettier-ignored).

## Coding conventions

### Validated functions (preferred pattern for service/data functions)

Business logic uses the **validated-function** pattern: a factory that injects dependencies
and wraps an inner `fn` with `withErrorHandlingAndValidation(fn, schema)`, so invalid input
throws a structured `ValidationError` before the operation runs and tests inject stubs with
no live services. In this repo, schemas and client interfaces live in `@qcobro/common`
(`src/schemas/`, `src/types/`). Apply it to input-validating operations — not trivial pure
helpers or framework glue.

Full guide, rationale, and scaffolding: `/ps:create-validated-function`
(source: github.com/psanders/psstack).

### General

- TypeScript strict; no `any` (ESLint enforces `@typescript-eslint/no-explicit-any`).
- Share contracts via `@qcobro/common`; don't duplicate types between apiserver and webapp.
- All user-facing console text goes through the i18n layer (`mods/webapp/src/lib/i18n.tsx`),
  never hardcoded literals. The product is multilingual; assume no single default language.
- Reach services through the tRPC context, not via ad-hoc imports inside procedures.

## Commits

Use **Conventional Commits** (`type(scope): subject`, e.g. `feat(api): add objectives router`).
A Husky `commit-msg` hook runs commitlint and rejects non-conforming messages.
