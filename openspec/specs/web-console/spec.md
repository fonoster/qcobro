# web-console Specification

## Purpose

TBD - created by archiving change project-foundation. Update Purpose after archive.

## Requirements

### Requirement: React + Vite console shell

The web console SHALL be a React single-page application built with Vite and styled with Tailwind CSS. It SHALL provide an application shell with client-side routing into which feature pages are mounted in later changes.

#### Scenario: App builds and serves

- **WHEN** `npm run build` is executed for the `webapp` package
- **THEN** Vite produces a production build without type or build errors

#### Scenario: Shell provides routing

- **WHEN** the console is loaded
- **THEN** an application shell renders and client-side routing resolves a default route

### Requirement: Type-safe API client wiring

The console SHALL communicate with the apiserver through a tRPC client typed against the apiserver's `AppRouter`, so that API calls are end-to-end type-checked.

#### Scenario: Client is typed against the server

- **WHEN** the console's tRPC client is inspected
- **THEN** it is parameterized by the `AppRouter` type exported by the apiserver

### Requirement: Internationalization-ready text

The console SHALL render all user-facing text through an internationalization layer rather than hardcoded literals, and the active language SHALL be configurable. No language SHALL be assumed as the only option.

#### Scenario: Text resolved via i18n

- **WHEN** a page renders user-facing copy
- **THEN** the copy is resolved through the i18n layer keyed by message identifiers

#### Scenario: Language is configurable

- **WHEN** the configured language is changed
- **THEN** the console renders user-facing text in the selected language without code changes

### Requirement: Component development in Storybook

The console SHALL include Storybook so reusable components can be developed and reviewed in isolation.

#### Scenario: Storybook builds

- **WHEN** the Storybook build script is executed for the `webapp` package
- **THEN** a static Storybook is produced without errors
