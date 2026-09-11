# Design — SMS sending cost while authoring

## Decision 1: implement the packing rule, not the thresholds

"160 characters, or 70 with an accent, or 153/67 when it splits" is the folklore version and it is
wrong at exactly the edges an operator hits. The real rule is bit packing: characters are placed
into 1120-bit segments; a GSM-7 character is 7 bits, an _extended_ GSM-7 character (`€ [ ] { } ~ ^
|`) is 14, a UCS-2 code unit is 16; and once a message needs a second segment, every segment
spends 48 bits on a reassembly header.

Implementing that gets two cases right that a threshold check does not:

- an extended character's two septets may not straddle a segment boundary, so 159 plain characters
  followed by `€` is two segments, not one;
- an emoji is one character to a reader and two 16-bit units to the carrier.

The thresholds then fall out of the arithmetic (1120/7 = 160, 1072/7 = 153, 1120/16 = 70,
1072/16 = 67) and are asserted in the tests as consequences rather than encoded as rules.

Graphemes come from `Intl.Segmenter`, which the repo's `lib: ["ES2022"]` already types — no new
dependency for emoji-aware counting.

## Decision 2: count sample-rendered text, not the raw template

Counting the raw template is cheaper and wrong twice over. `{{outstandingBalance}}` is 21
characters where `9,500` is five — so the number is simply incorrect whenever a placeholder is
present. More importantly it is blind to the actual failure mode: it is the _substituted value_
that usually changes the encoding. An operator's template can be pure ASCII and still send every
message to half the customer base at double price, because their names are `García` and
`Martínez`.

So the console renders the body against a canned sample account through the same
`buildOutreachContext` + `renderTemplate` pair a real dispatch uses — the precedent already exists
client-side in `ReachOutModal.tsx`, which does exactly this for a real account.

The sample's name is deliberately `María Rodríguez`: a sample with a plain ASCII name would hide
the case worth warning about. Its money values format for the real workspace locale, so the count
reflects `9,500` rather than `9500` in markets that group thousands.

Because the sample is not the real account, the estimate is labelled `≈`. That is honest: the true
count varies per contact, and no single number can be correct for a whole portfolio.

`renderTemplate` returns a visible `[Error de plantilla: …]` marker instead of throwing on a
malformed template. That marker is not message content, so the estimate is suppressed rather than
counting it.

## Decision 3: a five-character substitution table, hand-written

The tempting implementation is `text.normalize("NFD").replace(/\p{M}/gu, "")`. It is one line and
it is unacceptable here: it rewrites `ñ`→`n`, turning `año` into a vulgarity that would be sent to
customers, and it strips diacritics from `é ü à ö` which were already free — changing the copy for
no saving whatsoever.

The table is therefore explicit and contains only characters that are (a) outside GSM-7 and (b)
have an equivalent a reader would not notice: `á í ó ú Á Í Ó Ú ç`. It is asserted against the same
charset table the calculator uses, and the tests pin `año`, `José` and `Müller` as unchanged.

Emoji are excluded on the same principle in the other direction: there is no ASCII equivalent, so
the only available "normalization" is deletion, which silently edits what the operator wrote.

## Decision 4: normalize after rendering, at dispatch

Normalization lives in `dispatchOutreach`'s SMS branch, immediately after `renderTemplate`, for
three reasons:

- **After rendering**, because the substituted value is the usual culprit (Decision 2). Normalizing
  the template alone would miss every case that motivated the feature.
- **At dispatch**, rather than at each call site, so the campaigns engine and the manual flow
  cannot diverge.
- The value returned as `renderedBody` is therefore the normalized text, which is what gets stored
  as the gestión's `channelData.messageBody`. The record shows what the customer received, not what
  the template said.

`ReachOutModal`'s SMS preview applies the same substitution for the same reason — otherwise the
operator edits and approves text that differs from what is sent.

## Decision 5: a sibling line, not the field's `hint`

`TextareaGroup` suppresses `hint` whenever `error` is set, and types it as `string`. Routing the
estimate through `hint` would mean it vanishes exactly when a validation error appears, and would
displace the existing `{{variable}}` example that issue #118 added. It is rendered as a sibling
`<p>` instead, so both survive.

The component is shared by the create and edit modals, which are otherwise duplicated JSX with no
shared form component — matching the existing `FIELD_PLACEHOLDER`/`FIELD_HINT` convention for
keeping the two in sync.

## Open question

The estimate will reveal what real templates actually contain. If `nonGsmCharacters` commonly shows
typographic punctuation pasted from a word processor — `'` `"` `–` `—` `…`, none of which are in
GSM-7, all of which have unambiguous ASCII equivalents — extending the substitution table is the
obvious next step. Deliberately not done pre-emptively.
