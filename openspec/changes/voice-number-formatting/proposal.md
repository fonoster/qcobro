## Why

Text-to-speech on the pre-recorded voice channel mispronounces bare numbers: an outstanding
balance of `9500` and a phone number of `8092323333` are both read wrong, while `9,500` and
`8 0 9 2 3 2 3 3 3 3` are read correctly. The TTS provider offers no SSML `<say-as>` control,
so the only lever is the text QCobro produces. Today `buildOutreachContext` hands templates
raw numbers, so every operator-authored script inherits the problem.

## What Changes

- **Money-typed context fields render locale-formatted by default.** `outstandingBalance`,
  `principalAmount`, `termsAmount` and `lastPaymentAmount` come out of the render context as
  formatted strings (`9,500` / `9.500` per locale). This is transparent to the operator —
  existing templates start sounding right with no edit and no new syntax to learn.
- **Count fields stay raw.** `daysPastDue`, `missedInstallments` and `termsLength` are counts,
  not money, and must not acquire thousands separators.
- **Numeric helpers keep working on formatted values.** `multiply`, `eq`, `gt`, `gte`/`ge`,
  `lt`, `lte` parse their operands locale-aware before comparing, and `multiply` formats its
  result the same way money fields are formatted. The settlement example documented today,
  `{{multiply outstandingBalance 0.5}}`, must not regress to `0`.
- **New `locale` workspace setting, application-managed.** `WorkspaceSettings` gains a `locale`
  alongside `currency` and `timezone`, defaulting to `es-DO` — the only supported locale while
  QCobro is launched in the Dominican Republic only. Formatting is locale-dependent (`9,500` in
  es-DO vs `9.500` in es-ES), so the value is explicit and per-workspace rather than a constant
  buried in a formatter. It is **not** operator-editable yet: a picker with one entry is noise,
  and the plumbing is already in place for when a second market lands.
- **New `{{digits}}` helper.** `{{digits phone}}` renders `8 0 9 2 3 2 3 3 3 3` for
  digit-by-digit reading; also useful as `{{digits externalId}}`. This is the one piece that
  stays opt-in, because only the template author knows a value should be spelled out.
- **Docs updated** — the variables and helpers tables in the agent-templates guide, including
  the existing (undocumented) limitation that helpers do not work on the WhatsApp channel.

Explicitly **out of scope**: any automatic post-render speech-normalization pass. A number
typed literally into a script (`llámenos al 8092323333`) is not rewritten; that stays the
operator's responsibility, to be handled with `{{digits}}` or by writing it spaced.

Not breaking for stored data: templates are unchanged on disk, and only the rendered output
of money fields differs.

## Capabilities

### New Capabilities

None — this modifies existing behavior.

### Modified Capabilities

- `channel-dispatch`: the render-context requirement gains locale-aware money formatting for
  money-typed fields, raw counts, helper parsing/formatting rules, and the `digits` helper.
- `workspace-settings`: the settings record and its defaults gain a `locale` field, validated
  against the supported set. The operator-editable settings are unchanged.

## Impact

- `mods/common/src/utils/outreach.ts` — `buildOutreachContext` (money formatting), the
  registered Handlebars helpers (locale-aware parsing, `multiply` output formatting, new
  `digits`), and `buildAutopilotContextLines`, whose `typeof value === "number"` checks stop
  matching once money fields are strings.
- `mods/common` — workspace-settings schema/types gain `locale`.
- `mods/apiserver` — Prisma migration adding `WorkspaceSettings.locale`; the settings
  seed-on-read default; and every `buildOutreachContext` call site, which must now pass a
  locale: the campaigns engine, the outreach router, agent evaluations
  (`buildSyntheticAccount`), and the voice / WhatsApp / email inbound paths.
- `mods/webapp` — no settings UI, but `ReachOutModal`'s live preview must pass the same locale
  so the preview matches what is sent.
- `docs-site/guides/agent-templates.mdx` — variables and helpers tables.
