## 1. Pencil — Design (DONE)

- [x] 1.1 Gestiones list block (channel-aware table, monochrome)
- [x] 1.2 Detalle de gestión — SMS block (one-way: sent message, delivery, AI insight)
- [x] 1.3 Detalle de gestión — Pre-grabada block
- [x] 1.4 Detalle de gestión — Email block
- [x] 1.5 Detalle de gestión — Voz IA block (player, transcript, analysis, objetivo)
- [x] 1.6 Objetivos list block (KPI strip + table) — designed; implementation deferred

## 2. Spec reconcile (DONE)

- [x] 2.1 Reconcile web-console delta: Gestiones list + channel-aware detail; SMS first;
      Objetivos + Voz IA webhook + sidebar-Objetivos deferred

## 3. Build — SMS slice (Gestiones only) — DONE

- [x] 3.1 Align Gestiones list page to design: Cliente · Canal · Resultado · Resumen IA ·
      Fecha; monochrome channel indicator; plain-text outcome
- [x] 3.2 Make Detalle de gestión channel-aware; SMS branch (sent message, delivery,
      AI insight, metadata; no audio/transcript/objetivos)
- [x] 3.3 i18n keys for new labels (Canal/Resumen IA, sentMessage, delivery, sent) — en + es
- [x] 3.4 Persist the rendered SMS body in `channelData.messageBody` (outreach.dispatch);
      expose `externalId` in the contact-log list query

## 4. Tests — DONE

- [x] 4.1 E2E golden path (`e2e/gestiones-sms.spec.ts`): seed SMS gestión → list shows
      Canal + Resumen IA → open SMS detail (sent message shown, no transcript). Passing.
- [x] 4.2 No new validated function added in this slice → no new unit test required;
      full unit suite (65) + lint + typecheck green

## 5. Build — one-way channels Pre-grabada + Email — DONE

- [x] 5.1 Detail is channel-aware across SMS / Pre-grabada / Email (shared one-way path;
      channel-specific sent-content: bubble / player+guion / email card)
- [x] 5.2 Detail opens as a slide-over side panel over the dimmed list (`ui/slide-over.tsx`)
      per the design note; shared `lib/channelIcon`
- [x] 5.3 Generic per-channel AI insight via i18n (no LLM) for one-way channels
- [x] 5.4 e2e `gestiones-channels.spec.ts` seeds + verifies all three one-way panels. Green.

## Deferred (follow-ups, not this pass)

- [ ] Objetivos list implementation (page + sidebar nav item)
- [ ] Voz IA detail branch (player + transcript + full analysis + objetivo) +
      `CONVERSATION_ENDED` webhook ingestion (with auth follow-up); real LLM insight
      (generate-once-at-ingestion, or lazy-on-open + cache if cost matters)
