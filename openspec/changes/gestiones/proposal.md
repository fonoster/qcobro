## Why

The `account-contact-log` (Gestión) and `Objective` data models shipped with
`campaigns-core`, but the operator console still has no way to review outreach history or
track actionable outcomes. Operators need the **Gestiones** section (every recorded
outreach attempt, with audio/transcript/AI analysis) and the **Objetivos** section
(payment promises and other commitments that generalize the old "Promesas de Pago"
screen). These screens require substantial design work before implementation, so they are
split out of `campaigns-core` into their own change.

## What Changes

- Web console **Gestiones** list screen: outreach attempts across campaigns/portfolios.
- Web console **Detalle de gestión** screen: audio player, transcript, AI analysis,
  linked objectives.
- Web console **Objetivos** list screen: KPI strip + table; replaces "Promesas de Pago".
- Sidebar updated to include Agentes, Campañas, Gestiones, Objetivos.
- Application Flow gains CAMPAÑAS, GESTIONES, OBJETIVOS sections.

Design (Pencil) is the first stage and is deliberately deferred — references the old
Gestiones / Detalle de gestión / Promesas de Pago screens in `pencil-old.pen`.

## Capabilities

### Modified Capabilities

- `web-console`: Add Gestiones and Objetivos sections (list + gestión detail) and the
  corresponding sidebar nav items.

## Impact

- **Design**: Pencil screens for Gestiones list, Detalle de gestión, Objetivos list;
  sidebar + Application Flow updates.
- **`mods/webapp`**: New pages `Gestiones`, `GestionDetail`, `Objetivos`; sidebar nav.
- **No new data model** — reuses `AccountContactLog` and `Objective` from `campaigns-core`.
