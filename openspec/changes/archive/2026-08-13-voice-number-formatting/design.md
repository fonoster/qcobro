## Context

Pre-recorded voice calls play a Handlebars-rendered script through TTS (ElevenLabs
`eleven_multilingual_v2`). The provider exposes no SSML `<say-as>` control, so the spoken
result is entirely determined by the text QCobro produces. `buildOutreachContext`
(`mods/common/src/utils/outreach.ts`) currently copies `PortfolioAccount` fields into the
render context as raw values, so `outstandingBalance: 9500` reaches TTS as `9500` and is
mispronounced; `9,500` is read correctly. The same applies to phone-like digit runs, which
need to be read one digit at a time.

The render context is shared by every channel (SMS, email, WhatsApp, both voice types) and is
built in six places, including the webapp's live preview in `ReachOutModal.tsx` — which is
why it is a `@qcobro/common` concern and why preview and send must stay identical.

## Goals / Non-Goals

**Goals:**

- Amounts read correctly on voice with no template edit and no new syntax for the operator.
- Existing templates and their arithmetic (`{{multiply outstandingBalance 0.5}}`) keep working.
- Number formatting is governed by an explicit, operator-owned workspace setting.
- Template authors have an opt-in way to force digit-by-digit reading.

**Non-Goals:**

- No automatic post-render speech normalization. A literal `8092323333` typed into a script
  is not rewritten.
- No change to how the webapp _displays_ money in its own pages (several already hardcode
  `Intl.NumberFormat("es", …)`). Adopting the workspace locale there is a sensible follow-up,
  not part of this change.
- No per-template locale override. One workspace, one locale.

## Decisions

### Money fields are formatted strings in the context, not wrapper objects

`buildOutreachContext` emits `outstandingBalance`, `principalAmount`, `termsAmount` and
`lastPaymentAmount` as locale-formatted strings. Counts (`daysPastDue`, `missedInstallments`,
`termsLength`) stay numeric — a count with a thousands separator would be wrong.

_Alternative considered:_ a `Money` wrapper with `valueOf()` returning the raw number and
`toString()` returning the formatted text. Handlebars would stringify it formatted while
`Number()` inside the helpers still saw the number, so no helper would need to change. Rejected:
the context is typed `Record<string, unknown>` and is consumed as plain data elsewhere —
`buildAutopilotContextLines` branches on `typeof value === "number"` in four places and would
silently drop those lines from the Voz IA prompt, `{{#if outstandingBalance}}` would become
true at a zero balance, and any future `JSON.stringify` of the context would yield `{}`. Too
much action at a distance for a value that crosses module boundaries.

_Format:_ grouping separators always; two fraction digits when the amount has a fractional
part, none when it does not — so `9500` reads "nueve mil quinientos" and `9500.5` reads
"…con cincuenta" rather than "…punto cinco".

### Helpers parse locale-formatted operands

Because money fields are now strings, `multiply`/`eq`/`gt`/`gte`/`ge`/`lt`/`lte` replace their
bare `Number(x)` coercion with a shared `toNumber(value, locale)`. It cannot simply strip
commas: `9.500` is nine thousand five hundred in es-ES and nine-point-five in es-DO. The
separators are discovered per locale with `Intl.NumberFormat(locale).formatToParts(12345.6)`,
reading the `group` and `decimal` parts, then the string is normalized before `Number()`.
Unparseable operands keep today's behavior (`multiply` → `0`, comparisons → false), so a
malformed context still never produces `NaN` in customer-facing copy.

`multiply` formats its result with the same money formatter, so a computed settlement amount
reads aloud like a stored balance.

### Locale is a workspace setting, not the template's language

`WorkspaceSettings` gains `locale` next to `currency` and `timezone`. The per-template
`language` column was the alternative — it is closer to the spoken output — but it is not
available where the context is built (the engine builds a context per account, before the
template is in hand), it would mean a different number format per template in the same
portfolio, and it conflates "what language does the agent speak" with "how does this business
write numbers". One workspace-wide setting is what an operator can actually reason about.

Threading it through means changing `buildOutreachContext(account, { currency })` to also take
`locale`, and updating all six call sites. The webapp's preview must read the same setting, or
the preview stops matching what is sent.

`DEFAULT_LOCALE` is `es-DO`, and it is the only supported locale: QCobro is launched in the
Dominican Republic only. Validation accepts a curated list rather than any BCP-47 string, so an
unsupported tag cannot silently format amounts a way the deployment has never been checked
against.

With one supported locale, the setting is **application-managed** — persisted per workspace and
consumed by formatting, but with no console control. A dropdown with a single entry is noise,
and the alternative (hardcoding `es-DO` in the formatter) would leave a constant buried in
`common` for the second market to refactor out. Persisting it now makes adding a picker later a
UI-only change.

### `digits` stays an opt-in helper

Only the template author knows a value should be spelled out — `{{digits phone}}` is right,
`{{digits outstandingBalance}}` is not. It strips non-digits so stored formats like
`+1 (809) 232-3333` work, and renders empty for a missing value.

### No safety net

An automatic post-render pass (spacing long digit runs, adding separators to bare integers)
was considered and rejected: it rewrites text the operator wrote literally, and every extra
rule is a new way to mangle a date or an account reference. The cost is that a number typed
directly into a script is still read wrong; that is documented alongside `digits`.

## Risks / Trade-offs

- **A template does string comparison on a money field** (e.g. `{{#if (eq outstandingBalance
"0")}}`) → `eq` is strict equality and now sees `"0"` instead of `0`. No shipped template
  does this; the helper tests cover both operand shapes.
- **Locale-formatted amounts flow into non-voice channels too** — SMS, email, WhatsApp named
  parameters and the Voz IA context lines all get `9,500` instead of `9500`. This is an
  improvement everywhere, but it is a visible output change beyond voice, so the change
  touches more surface than the bug report implies.
- **`buildAutopilotContextLines` type checks** — its `typeof value === "number"` guards stop
  matching for money fields; missing one silently drops a line from the Voz IA system prompt.
  Covered by a test asserting the full set of lines for a fully-populated account.
- **Preview/send drift** — if `ReachOutModal` doesn't get the workspace locale, operators
  preview one thing and send another. Covered by an e2e assertion on the preview text.
- **WhatsApp cannot use helpers** — `extractTemplateTokens` only matches single-word
  `{{token}}`, so `{{digits phone}}` in a WhatsApp body would survive literally into the sent
  body. Pre-existing (it affects `multiply` too) and out of scope to fix, but it must be
  documented in the helpers table.

## Migration Plan

1. Prisma migration adds `WorkspaceSettings.locale` with a column default equal to
   `DEFAULT_LOCALE`, so existing rows backfill without a data script.
2. Ship the schema/type change in `@qcobro/common` and the context/helper changes together —
   they are one semantic unit; a version skew where the context formats but the helpers do not
   parse would break arithmetic in live templates.
3. Rollback is the inverse migration plus a revert; no data is lost, since templates are
   unchanged on disk and only rendered output differs.

## Open Questions

- Should the console's own money display (`Portfolios`, `PortfolioDetail`, `PaymentPromises`,
  `Home`) adopt the workspace locale in a follow-up? They currently hardcode `"es"`.
- When a second market lands: add the locale picker to the settings page (Pencil design, i18n'd
  control, Storybook story), and make `locale` part of the operator-editable update schema.
