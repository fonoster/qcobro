## Why

A round of operator-console refinements surfaced from real use. They are small, mostly
independent improvements — table density, a missing archive control, an over-strict
required field, and dashboard widgets still showing mock data. They are grouped here as
one "low hanging fruit first" refinement pass rather than a design-led feature.

## What Changes

- **Campaign archive/unarchive from the list**: the Campañas list row-actions menu gains
  "Archivar" (for non-archived campaigns) and "Restaurar" (for ARCHIVED campaigns).
  Restoring an ARCHIVED campaign returns it to `PAUSED` (it never auto-resumes dispatch).
  `ARCHIVED` is no longer a terminal status.
- **First message becomes optional** for `VOICE_AI` agent templates — an agent may rely on
  the system prompt alone with no scripted opening line.
- **Denser tables**: the creation-date column is dropped from the Carteras, Campañas, and
  Agentes tables to give the name column more room. The archived badge moves onto the name
  cell.
- **Panel de control on real data**: "Gestiones recientes", "Progreso por cartera", and the
  "Cuentas en gestión" KPI are sourced from live workspace data instead of mock constants.
  Per-cartera progress is a simulated value between 10% and 80% (deterministic per cartera),
  since there is no recovery-progress metric yet.

### Cleanup pass

- **Reserved language column**: the customer accounts table drops the preferred-language
  column; `preferredLanguage` stays on the record as a reserved field for future use.
- **First message as a single-line input** (not a textarea) in the create-agent form, and a
  muted placeholder in the manual-contact preview when a Voz IA agent has no first message
  ("(Not set. Will wait for the customer to start)").
- **Sync is Voz IA-only**: the synchronization indicator and re-sync action appear only for
  `VOICE_AI` templates; pre-recorded and text channels are managed locally (no sync UI).
- **Human-friendly language** in the agent detail (e.g. "Español" rather than `es`).
- **Config is the single source of truth**: `timezone` moves to the top level of
  `qcobro.json` as a general setting (reserved; not yet consumed); the pre-recorded
  VoiceServer `voicePort` is surfaced in `qcobro.json`; the apiserver build sources
  `DATABASE_URL` from `qcobro.json` (via the prisma wrapper), so the root `.env`/`.env.example`
  is removed — qcobro reads everything from `qcobro.json`.
- **Strategy removed**: confirmed no "collection strategy" remains in source (already gone).

## Capabilities

### Modified Capabilities

- `campaigns`: `ARCHIVED` is restorable to `PAUSED`; the status lifecycle is no longer
  terminal at ARCHIVED.
- `agent-templates`: `VoiceAiConfig.firstMessage` is optional.
- `web-console`: campaign list gains archive/restore row actions; Carteras/Campañas/Agentes
  tables drop the creation-date column; the Panel de control reads live data; the customer
  table drops the (reserved) language column; sync UI is Voz IA-only; agent-detail language
  is human-friendly; the manual-contact preview handles an unset Voz IA first message.
- `data-persistence`: the database connection is sourced from `qcobro.json` (no
  `.env`/`.env.example` required).

## Impact

- **`mods/common`**: `firstMessage` schema/type relaxed to optional; campaign status
  transition map allows `ARCHIVED → PAUSED`.
- **`mods/apiserver`**: Prisma `VoiceAiConfig.firstMessage` → nullable (migration);
  `updateCampaignStatus` already enforces the transition map (no logic change).
- **`mods/webapp`**: Campaigns, Portfolios, AgentTemplates tables; CreateAgentTemplate form;
  Home (Panel de control) wired to `contactLog.list`, `portfolios.list`, `objective.list`.
- **No new backend endpoints** — the dashboard reuses existing queries.
