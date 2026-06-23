## 1. Low-hanging fruit — tables & verification

- [x] 1.1 Verify agent template archive/unarchive already works end-to-end (no change expected)
- [x] 1.2 Drop creation-date column from Carteras table; move archived badge onto name cell
- [x] 1.3 Drop creation-date column from Campañas table
- [x] 1.4 Drop creation-date column from Agentes table; move archived badge onto name cell

## 2. Campaign archive / unarchive

- [x] 2.1 Allow `ARCHIVED → PAUSED` in `campaignStatusTransitions`
- [x] 2.2 Add "Archivar" + "Restaurar" actions to the Campañas list row menu (+ i18n)

## 3. Optional first message (VOICE_AI)

- [x] 3.1 Relax `firstMessage` to optional in `@qcobro/common` schema + type
- [x] 3.2 Make `VoiceAiConfig.firstMessage` nullable in Prisma + migration
- [x] 3.3 Ensure create/update agent flows and Fonoster sync tolerate an empty first message

## 4. Panel de control on real data

- [x] 4.1 "Gestiones recientes" from `contactLog.list` (recent attempts, relative time)
- [x] 4.2 "Progreso por cartera" from `portfolios.list`, progress simulated 10–80% (deterministic)
- [x] 4.3 "Cuentas en gestión" KPI = sum of active portfolios' accountCount

## 5. Cleanup pass

- [x] 5.1 Drop preferred-language column from the customer accounts table (keep field reserved)
- [x] 5.2 First message: textarea → single-line input in the create-agent form
- [x] 5.3 Manual-contact preview: muted placeholder when Voz IA agent has no first message
- [x] 5.4 Sync indicator + re-sync action shown only for `VOICE_AI` (not pre-recorded/text)
- [x] 5.5 Agent detail: map language code to human-friendly label
- [x] 5.6 Move `timezone` to top-level of `qcobro.json` config (reserved; unused)
- [x] 5.7 Surface pre-recorded VoiceServer `voicePort` in `qcobro.json`
- [x] 5.8 Source `DATABASE_URL` from `qcobro.json` in the build; remove `.env`/`.env.example`
- [x] 5.9 Confirm "collection strategy" is gone from source (verify only)

## 6. Tests

- [x] 6.1 Unit: `updateCampaignStatus` restores ARCHIVED → PAUSED; rejects invalid target
- [x] 6.2 Unit: agent template create/update accepts empty/omitted first message
- [x] 6.3 Lint + typecheck + test green (incl. e2e for affected flows)
