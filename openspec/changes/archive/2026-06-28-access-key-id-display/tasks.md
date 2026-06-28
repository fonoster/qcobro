## 1. Shared copy primitive

- [x] 1.1 Create `mods/webapp/src/components/CopyField.tsx`: a labeled copy row (`variant="field"`:
      mono code box + outline copy button with Check/Copy swap and transient "copied" state) plus an
      inline variant (`variant="inline"`: label-less mono value + icon-only copy button, truncates long
      values via CSS, copies the full value, `stopPropagation` so it can live inside a clickable parent).
      Shared `useClipboard` hook. Copy/copied text via i18n (`common.copy`/`common.copied`).
- [x] 1.2 Add `CopyField.stories.tsx` covering field, field-no-label, inline, and inline-in-chip.
- [x] 1.3 Refactor `ShowSecretDialog.tsx` to consume `CopyField` (variant="field") and remove its
      private `CopyRow`.

## 2. i18n

- [x] 2.1 Renamed `apiKeys.copy`/`apiKeys.copied` → neutral `common.copy`/`common.copied`; added
      `createWorkspace.card.accessKeyIdAria`, `home.workspaceId`, `home.workspaceIdAria` to English +
      Spanish. Parity enforced at compile time by `MessageId` (keyof intersection) — typecheck green.

## 3. Workspace picker surface

- [x] 3.1 In `Workspaces.tsx`, render the inline `CopyField` with `ws.accessKeyId` in a bottom row
      (slate pill) alongside the settings gear; copy `stopPropagation`s so it does not select/navigate.

## 4. Dashboard surface

- [x] 4.1 In `Home.tsx`, render a small header chip (key icon + "ID del espacio" label + inline
      `CopyField`) with the active workspace's `accessKeyId`.

## 5. Tests & gates

- [x] 5.1 E2E (`e2e/workspace-access-key.spec.ts`): asserts the accessKeyId (WO…) is visible and
      copyable on the dashboard and on a `/workspaces` card, and that copying on the card does not
      navigate. Verified live + screenshot review of both surfaces.
- [x] 5.2 Lint, typecheck, unit (18/18), and regression e2e (api-keys, auth-workspaces) all green.
      No validated function added (pure UI change), so no new unit-test file applies.
