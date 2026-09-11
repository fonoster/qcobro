## 1. Design

- [x] 1.1 Add the estimate line and the normalization checkbox to the `Crear agente · SMS` modal
      frame in `pencil.pen`, under the message-body field
- [ ] 1.2 The design has no SMS variant of the edit modal (its only edit frame is VOICE_AI). The
      create frame is the reference for both; add an edit-SMS frame only if the design file starts
      carrying per-channel edit frames generally

## 2. The calculation

- [x] 2.1 `mods/common/src/utils/smsSegments.ts` — `calculateSmsSegments(text)`, implementing the
      bit-packing rule rather than the familiar thresholds, with the GSM 03.38 basic and extension
      tables. Graphemes via `Intl.Segmenter` (already typed by the repo's `lib: ["ES2022"]`, so no
      new dependency)
- [x] 2.2 `normalizeForGsm7(text)` in the same file — the explicit `á í ó ú Á Í Ó Ú ç` table, with
      a comment on why it is not an NFD de-accent
- [x] 2.3 Named re-exports from `mods/common/src/utils/index.ts`

## 3. The flag

- [x] 3.1 `normalizeGsm7 Boolean @default(false)` on `SmsConfig` + an additive migration
- [x] 3.2 `mods/common/src/schemas/agentTemplates.ts` — the SMS create variant gains the optional
      boolean (the SDK/MCP/ctl surfaces reuse this schema and pick it up for free)
- [x] 3.3 `mods/common/src/schemas/dispatch.ts` — `DispatchOutreachInput` gains `normalizeGsm7`
- [x] 3.4 `dispatchOutreach.ts` SMS branch — substitute after rendering, so `renderedBody` (and
      therefore the gestión's stored body) is the text that was sent
- [x] 3.5 Thread it from `engine/engine.ts` + `engine/prismaEngineClient.ts` and from
      `trpc/routers/outreach.ts`; persist it in `createAgentTemplate.ts`. The update path forwards
      its `config` bag to Prisma unchanged, so it needs nothing

## 4. The console

- [x] 4.1 `mods/webapp/src/lib/sampleAccount.ts` — a `PortfolioAccountRecord` whose name
      deliberately breaks GSM-7, so the estimate demonstrates the case worth seeing
- [x] 4.2 A shared `SmsFields` component used by both agent-template modals, rendering the estimate
      as a sibling `<p>` (not `TextareaGroup`'s `hint`, which is suppressed by `error`)
- [x] 4.3 Suppress the estimate on an empty body, and on `renderTemplate`'s
      `[Error de plantilla: …]` marker
- [x] 4.4 Wire the flag into create state/payload and edit state/seed/save
- [x] 4.5 `ReachOutModal.tsx` SMS preview applies the same substitution, or it previews text that
      will not be sent
- [x] 4.6 Four i18n keys in **both** the `en` and `es` tables (`MessageId` is their intersection);
      interpolate at the call site with `.replace()`, the existing convention

## 5. Tests

- [x] 5.1 `smsSegments.test.ts` — the 160/161 and 70/71 boundaries, the 153/67 concatenated
      budgets, `€` counting double, an extended character refusing to straddle a boundary, emoji as
      one grapheme but two code units, and explicitly that `é ñ ¿` stay GSM-7 while `á í ó ú` do not
- [x] 5.2 `smsSegments.test.ts` — `normalizeForGsm7` leaves `año`, `José`, `Müller` untouched and
      leaves an emoji in place
- [x] 5.3 `dispatchOutreach.test.ts` — flag off leaves the body byte-identical; flag on substitutes
      only the costly characters, including one arriving via a placeholder

## 6. Verify

- [x] 6.1 `npm test` in `mods/common` and `mods/apiserver`; typecheck all three packages
- [x] 6.2 Migration applied to the dev database; `engine.integration.test.ts` passes against it
- [ ] 6.3 Drive the console: type past 160, type an accented name, tick the box, confirm the
      number moves and that `año`/`José` survive. Repeat in the edit modal
