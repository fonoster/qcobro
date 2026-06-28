## Context

Operators integrate with QCobro via the SDK (`useWorkspace(accessKeyId)`) and the REST API
(`x-workspace: <accessKeyId>` header). The docs reference this value, but the console never
shows it, so operators cannot easily obtain it. `accessKeyId` is already returned on both
`workspaces.summaries` (used by `/workspaces`) and `workspaces.list` (used by the dashboard),
so no backend work is needed. A copy-to-clipboard row already exists, but it is a private
`CopyRow` inside `ShowSecretDialog.tsx`.

## Goals / Non-Goals

**Goals:**

- Show the workspace `accessKeyId` on each `/workspaces` card and on the dashboard (active
  workspace), each with a one-click copy affordance and transient "copied" confirmation.
- Reuse one copy primitive across the API-key dialog and the two new surfaces.
- Keep all copy in the i18n catalogs at en/es parity.

**Non-Goals:**

- No backend, schema, or contract changes.
- Not exposing any secret — only the public `accessKeyId`.
- No redesign of the workspace card or dashboard layout beyond adding the ID area.

## Decisions

- **Extract a shared copy primitive.** Move `CopyRow` out of `ShowSecretDialog.tsx` into a
  shared `components/CopyField.tsx` (Storybook story per variant). `ShowSecretDialog`
  consumes it unchanged. Rationale: avoid a third copy of `navigator.clipboard` logic; the
  existing pattern (mono code box + outline button + Check/Copy icon swap) is already the
  house style. Alternative considered: copy-paste the logic inline on each surface —
  rejected (duplication, drift).
- **Two presentations of the same primitive.** The full labeled `CopyField` (label above a
  code box + button) fits the dashboard's small area and could fit the dialog. The
  `/workspaces` card is space-constrained (200×280), so the card uses a **compact** variant:
  a single inline row (mono `accessKeyId`, truncated, + a small icon-only copy button) with
  no label — the card context already says "workspace". Implement compact as a prop/variant
  of the same component rather than a second component.
- **Card copy must not select the workspace.** The card's root `onClick` selects the
  workspace and navigates. The copy control SHALL call `stopPropagation()` (same pattern the
  card's existing Settings button already uses).
- **Dashboard placement.** Put the ID area in the header block (next to/under the title +
  subtitle), not as a 6th KPI card — it is reference metadata, not a metric.

## Risks / Trade-offs

- **Clipboard API availability** → `navigator.clipboard.writeText` requires a secure context;
  the console runs over HTTPS/localhost, matching the existing `ShowSecretDialog` usage, so
  no new risk. No fallback added (parity with current behavior).
- **Truncation on the compact card variant** → the full value is still copyable even when
  visually truncated; the copy action uses the underlying value, not the displayed text.

## Open Questions

- Exact visual treatment of the compact card row is a Pencil/design-stage decision; the
  spec only requires "displayed + copyable", so design iteration won't change behavior.
