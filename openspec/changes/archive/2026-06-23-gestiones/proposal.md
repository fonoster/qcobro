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
- Web console **Detalle de gestión** screen — **channel-aware** across Pre-recorded, SMS,
  and Voz IA: audio player + transcript + full AI analysis + linked objectives for Voz IA;
  for one-way channels (SMS, Pre-recorded) no player/transcript, and the AI insight reflects
  that the channel is one-way with no captured response.
- Web console **Objetivos** list screen: KPI strip + table; replaces "Promesas de Pago".
- Sidebar updated to include Agentes, Campañas, Gestiones, Objetivos.
- Application Flow gains CAMPAÑAS, GESTIONES, OBJETIVOS sections.
- **apiserver Voz IA webhook**: a new endpoint that ingests the Fonoster autopilot
  `CONVERSATION_ENDED` event (`appRef`, `callRef`, `phone`, `chatHistory`, `recordingUrl`)
  and records/updates the corresponding Voz IA gestión (transcript + recording + AI
  analysis). **Unauthenticated for now — this MUST be secured very soon** (tracked as a
  follow-up). SMS and Pre-recorded have no callback by design.

Design (Pencil) is the first stage and is deliberately deferred — references the old
Gestiones / Detalle de gestión / Promesas de Pago screens in `pencil-old.pen`.

Sequencing: build the low-hanging-fruit one-way channels (SMS, Pre-recorded) display path
first, then invest the remaining effort in the Voz IA webhook ingestion.

## Capabilities

### Modified Capabilities

- `web-console`: Add Gestiones and Objetivos sections (list + channel-aware gestión detail)
  and the corresponding sidebar nav items.
- `channel-dispatch` (or apiserver ingestion): Add the Voz IA `CONVERSATION_ENDED` webhook
  that records/updates a gestión from the Fonoster autopilot callback.

## Impact

- **Design**: Pencil screens for Gestiones list, Detalle de gestión, Objetivos list;
  sidebar + Application Flow updates.
- **`mods/webapp`**: New pages `Gestiones`, `GestionDetail`, `Objetivos`; sidebar nav.
- **`mods/apiserver`**: New Voz IA webhook endpoint (REST), mapping the autopilot
  `CONVERSATION_ENDED` payload onto a contact-log write. Unauthenticated initially —
  **security follow-up required**.
- **No new data model** — reuses `AccountContactLog` and `Objective` from `campaigns-core`.
