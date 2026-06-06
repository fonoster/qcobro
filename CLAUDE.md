# QCobro — Agent Guide

QCobro (by Fonoster) is a **multilingual** AI-voice debt-collections platform. It is being
rebuilt spec-first with OpenSpec. The previous implementation is archived on the `demo` branch.

## How work is organized

- **Product behavior (the WHAT)** lives in OpenSpec specs under `openspec/specs/`, and is changed
  through proposals in `openspec/changes/`. Use `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.
  Specs describe observable, testable behavior — not coding style.
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

When defining a function that takes external input and performs an operation (DB writes,
service calls, business logic), use the **validated-function** pattern: a builder that injects
dependencies and wraps the logic with Zod validation.

```typescript
import {
  withErrorHandlingAndValidation,
  createCustomerSchema,
  type CreateCustomerInput,
  type CustomerClient
} from "@qcobro/common";

export function createCreateCustomer(client: CustomerClient) {
  const fn = async (params: CreateCustomerInput) => {
    return client.customer.create({ data: params });
  };

  return withErrorHandlingAndValidation(fn, createCustomerSchema);
}
```

- Schemas and client interfaces live in `@qcobro/common` (`src/schemas/`, `src/types/`).
- Dependencies are injected (the outer `create…` takes the client), so tests swap real clients
  for mocks — no live services needed.
- Invalid input throws `ValidationError` (field-level errors, `toJSON()` for API responses)
  before the inner function runs.
- Full guide and scaffolding: run `/create-validated-function`.

> Apply this pattern when it fits (input-validating operations). Trivial pure helpers or
> framework glue don't need it.

### General

- TypeScript strict; no `any` (ESLint enforces `@typescript-eslint/no-explicit-any`).
- Share contracts via `@qcobro/common`; don't duplicate types between apiserver and webapp.
- All user-facing console text goes through the i18n layer (`mods/webapp/src/lib/i18n.tsx`),
  never hardcoded literals. The product is multilingual; assume no single default language.
- Reach services through the tRPC context, not via ad-hoc imports inside procedures.

## Commits

Use **Conventional Commits** (`type(scope): subject`, e.g. `feat(api): add objectives router`).
A Husky `commit-msg` hook runs commitlint and rejects non-conforming messages.
