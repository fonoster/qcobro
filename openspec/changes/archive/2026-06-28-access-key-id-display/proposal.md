## Why

The SDK and API docs instruct operators to authenticate and scope requests with their
workspace's `accessKeyId` (the `x-workspace` header, `useWorkspace(accessKeyId)`), but the
console gives them no way to find that value. Today they must reverse-engineer it from a
token or ask support. Surfacing and making it copyable removes that friction for everyone
integrating against QCobro.

## What Changes

- Each workspace card on `/workspaces` displays that workspace's `accessKeyId` with a
  one-click copy affordance.
- The Panel de control (Home dashboard) displays the **active** workspace's `accessKeyId`
  in a small, copyable area near the page header.
- Extract the copy-to-clipboard row currently embedded in `ShowSecretDialog.tsx` into a
  shared, reusable component and use it (or a compact variant) on both surfaces.
- All new user-facing copy is added to the i18n catalogs (English + Spanish at parity).

No data-layer work: `accessKeyId` is already returned on the `workspaces.summaries` and
`workspaces.list` payloads. This is a frontend-only visibility change.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `web-console`: Adds a requirement that the console display the workspace `accessKeyId`
  on the workspace picker cards and on the dashboard, each with a copy affordance.

## Impact

- `mods/webapp/src/pages/Workspaces.tsx` — render + copy `accessKeyId` per card.
- `mods/webapp/src/pages/Home.tsx` — render + copy the active workspace's `accessKeyId`.
- `mods/webapp/src/components/ShowSecretDialog.tsx` — extract `CopyRow` to a shared
  component (new file under `components/`), update the dialog to consume it.
- `mods/webapp/src/lib/i18n.tsx` — new keys (en + es).
- No changes to `mods/apiserver`, `mods/common`, Prisma, or any contract.
