## Why

SMS templates are quietly producing more billable messages than anyone intended, and there is
nowhere in the product to notice before the invoice. `AgentTemplates.tsx` enforces no length at
all today — `agentTemplates.ts` has `messageBody: z.string().min(1)` and no maximum — so this is
the first length feedback SMS authoring has ever had.

Segmentation is not a character count. A message is packed into 140-byte parts; a single
character outside the GSM 7-bit alphabet forces the whole thing into 16-bit encoding and drops the
budget from 160 characters to 70. The usual assumption — "accents cost extra" — is wrong in a way
that matters here: `é è ñ Ñ ü ä ö å à ì ò ù ß ¡ ¿ £ ¥` are all _in_ the 7-bit set and cost nothing.
What is missing is `á í ó ú` and lowercase `ç`. So `José` and `año` are free, and `García`,
`Martínez` and `Rodríguez` double the price of an otherwise-fine message.

That makes the substituted value, not the operator's own text, the usual culprit — which no
amount of staring at the template would reveal.

## What Changes

- **`calculateSmsSegments(text)` in `@qcobro/common`** — a pure, provider-agnostic function
  implementing the actual packing rule (graphemes via `Intl.Segmenter`, 7/14/16 bits per
  character, 1120-bit segments, 48-bit reassembly header once concatenated) rather than the
  familiar thresholds, which are consequences of it. Ported from Twilio's open-source reference
  calculator (MIT); nothing in the public API names a vendor.
- **A live estimate under the SMS body field**, in both the create and edit modals, counting
  **sample-rendered** text. One line, no panel. It names the character that changed the encoding
  when there is one.
- **`normalizeForGsm7(text)` and a per-template `normalizeGsm7` flag** — the operator's lever, in
  the same place they see the cost. Substitutes exactly `á í ó ú Á Í Ó Ú ç` and nothing else,
  applied at dispatch _after_ rendering so it reaches substituted values.

Explicitly **not** included: emoji. They are the other 16-bit trigger and have no ASCII
equivalent, so "normalizing" one means deleting it from the operator's copy. Left in place, and
surfaced in the estimate instead.

Also deliberately narrow: a blanket Unicode de-accent is one line of code and would rewrite `ñ`→`n`,
turning `año` into something vulgar, and strip characters that were already free. The substitution
table is hand-written for that reason and must not become a general de-accenter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-templates`: `SmsConfig` gains `normalizeGsm7`; two new requirements cover the authoring
  estimate and the normalization option.
- `channel-dispatch`: the SMS dispatch requirement gains that normalization runs after rendering
  and that the recorded body is the normalized text.

## Impact

- **Contracts:** `@qcobro/common` gains `calculateSmsSegments`, `normalizeForGsm7`,
  `SmsSegmentInfo`; the SMS create schema and `DispatchOutreachInput` gain `normalizeGsm7`.
- **Database:** one additive column, `sms_configs.normalizeGsm7 BOOLEAN NOT NULL DEFAULT false`.
  Every existing template backfills to off, so no message in flight changes text.
- **apiserver:** `dispatchOutreach.ts` (the SMS branch), `engine/engine.ts` +
  `engine/prismaEngineClient.ts`, `trpc/routers/outreach.ts`, `createAgentTemplate.ts`. The update
  path needs no change — it forwards its `config` bag to Prisma.
- **Web console:** a shared `SmsFields` component consumed by both agent-template modals, a sample
  account for previewing, four i18n keys in both language tables, and the `ReachOutModal` SMS
  preview (which must apply the same substitution or it previews text that will not be sent).
- **SDK/MCP/ctl:** pick the field up through the shared schema; no separate edits.
- **Not affected:** EMAIL, WHATSAPP and both voice channels. Segmentation is an SMS concept.

## Follow-ups, not in scope

- Operator-facing documentation on segmentation (the issue puts it out of scope explicitly).
- `mods/common/src/billing/evaluate.ts` prices SMS **per segment** while billing a flat rate per
  message. This work makes that discrepancy concrete; it deserves its own issue.
- Typographic characters pasted from word processors — curly quotes, en/em dashes, `…` — are also
  outside GSM-7 and also have unambiguous ASCII equivalents. They were left out of the
  substitution table to keep this change to what was agreed, but the estimate's
  `nonGsmCharacters` will show whether real templates contain them.
