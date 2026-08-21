## Context

`VoiceServer` (`mods/apiserver/src/voice/voiceServer.ts`) is a co-located, embedded Fonoster
application for pre-recorded calls: `answer → say(script) → hangup`, then an in-process
completion sink (`onCompleted`) reports the answered duration so `recordPrerecordedOutcome`
sets `entrega`/`durationSeconds` and usage settles. The gestión is created at dispatch with
`entrega: DISPATCHED`.

`account-contact-log` currently hard-codes `VOICE_PRERECORDED` (with `SMS`) as a channel with
**no inbound path at all** — `channelCanEngage()` in `mods/common/src/schemas/contactLog.ts`
returns `false` for it, and `createContactLogSchema` actively _rejects_ a write that sets
`camino`/`resultado` on either channel. This change needs `VOICE_PRERECORDED` to set a
`resultado` when (and only when) the operator configured a DTMF menu and the caller pressed
the opt-out digit — the schema-level rejection has to change from "never" to "only without
an active menu press."

## Goals / Non-Goals

**Goals:**

- Let a caller replay the script, bounded, without changing the default (no-menu) call flow.
- Let a caller opt out in-call, recorded as `resultado: OPT_OUT` — consistent with how every
  other channel already records an opt-out (visible, not auto-suppressing; see
  `account-contact-log`'s "An opt-out is recorded but suppresses nothing" scenario).
- Keep the menu entirely operator-authored and opt-in per template; a template with no digits
  configured behaves exactly as today, with zero added latency or gather cost.

**Non-Goals:**

- Voz IA (`VOICE_AI`) — unaffected; the autopilot already handles "repeat that" conversationally.
- Automatic Do Not Contact / suppression from an in-call opt-out. Per the existing
  `campaign-triggers` stance (no `OPT_OUT` trigger type — an opt-out claim is recorded but not
  auto-enforced until issue #101's DNC list exists), this change does not add a new enforcement
  path for voice specifically.
- Platform-generated prompt copy. The invitation/opt-out spoken text is operator-authored in
  the template's Handlebars script/message fields, never synthesized by the platform.
- Multi-digit menus, DTMF-driven data capture, or any option beyond repeat/opt-out.

## Decisions

**1. Config shape — two independent optional slots on `VoicePrerecordedConfig`.**

```
repeatDigit?: string       // single digit "0"-"9"
repeatMessage?: string     // spoken before/around the replay, operator-authored
optOutDigit?: string
optOutMessage?: string
maxRepeats?: number        // default 2, only meaningful when repeatDigit is set
```

Both pairs are independently optional. Validation (in the agent-template create/update
validated function, alongside existing template validation):

- A message is required whenever its digit is set, and vice versa — an operator cannot half-
  configure one side.
- When both digits are set, they SHALL differ.
- Digits are single characters `0`-`9` (DTMF `*`/`#` excluded from v1 — no use case, and `#`
  is a common gather terminator that would be ambiguous to also treat as a menu option).

**2. Gather only when configured — zero-cost default path.**

The VoiceServer only calls `response.gather(...)` when at least one digit is configured for
the dispatched template. A template with no menu configured never gathers, never waits, and
never changes billed duration — preserving the issue's "opt-in, default off" framing without
needing a separate enable flag; an empty menu _is_ the off state.

**Alternative considered:** a separate boolean `dtmfMenuEnabled` flag plus the digit fields.
Rejected — it is one more setting for no behavioral gain; "no digits configured" already means
"nothing to offer."

**3. Repeat is capped, opt-out is terminal.**

`maxRepeats` (default 2) bounds how many times the script can be replayed in one call — after
the cap, a further repeat press hangs up the same as an unrecognized digit. The opt-out press,
by contrast, ends the call immediately (no further gather) — once someone asks to stop, the
call does not linger for more prompts.

**4. What gets recorded — `resultado` only for opt-out, not for repeat.**

- **Opt-out pressed:** `resultado: OPT_OUT`. This is the only new `resultado` value pre-recorded
  can ever produce, and it reuses the existing enum value and existing "recorded, visible, no
  auto-suppression" semantics — no new console concept, no new campaign-trigger behavior.
- **Repeat pressed (one or more times, up to the cap):** does **not** set a `resultado` and
  does **not** set `camino`. Rationale: `camino`'s values (`ENGAGED`/`ABANDONED`/`VOICEMAIL`)
  describe a conversation's path, which doesn't have an obvious mapping for a single replay
  keypress on a one-way script; inventing a meaning for it now is more likely to need revisiting
  than to be right the first time. The repeat count is still visible to operators as
  `channelData.repeatCount`, satisfying the "worth recording as an engagement signal" instinct
  from the issue without overloading a structured axis. **Flagged as an open question below** —
  reversible later without a schema change if the call turns out wrong (`camino: ENGAGED` could
  be added for a repeat press without touching the enum).
- **`channelCanEngage()` becomes press-conditional, not channel-fixed, for this one channel:**
  the schema-level rejection in `createContactLogSchema` currently blocks _any_ write that sets
  `camino`/`resultado` for `VOICE_PRERECORDED`. It changes to allow `resultado: OPT_OUT`
  specifically (still rejecting `camino` on this channel, and still rejecting any other
  `resultado` value) — not a blanket "this channel can now engage," to keep the invariant as
  tight as before for everything except the one new case.

**5. Prompt sequencing lives entirely in the operator's script/messages, not the platform.**

The VoiceServer plays `script`, then — only if a menu is configured — plays `repeatMessage`
and/or `optOutMessage` (whichever are set) before gathering. The platform does not compose,
translate, or number the options ("presione 1 para..."); that phrasing is the operator's job,
consistent with the issue's explicit multilingual rationale.

**6. Console changes are additive, not new components.**

`Resultado` already renders "only when non-null" everywhere else (per the just-synced
`account-contact-log`/`web-console` model). The fix is removing `VOICE_PRERECORDED`'s blanket
exception from the "no `Camino` field and no `Resultado` row" scenario in `web-console`'s
Channel-aware Detalle de gestión and from the Gestiones list — no new UI pattern, no Pencil
component work beyond confirming the pre-recorded detail block and list row degrade correctly
with a `Resultado` value present. `Camino` stays hidden for this channel (per decision 4).

## Risks / Trade-offs

- **[Risk]** A caller mashing the repeat digit near `maxRepeats` inflates call duration/cost
  right up to the cap. → **Mitigation**: cap defaults to 2 (bounded worst case: script length ×
  3 plays + prompts), tunable per template; still far cheaper than an unbounded loop.
- **[Risk]** Digit collision with something in the script itself (e.g., an account number read
  aloud) is not machine-checkable. → **Mitigation**: none needed — DTMF is only gathered after
  the full script finishes playing, so in-script spoken digits are never in a gather window.
- **[Risk]** Loosening `channelCanEngage`'s rejection for one channel/one value is a narrower
  but still real crack in an invariant that was just tightened in `contact-log-axes`. →
  **Mitigation**: the validation stays value-specific (`OPT_OUT` only, `VOICE_PRERECORDED`
  only) rather than flipping the channel to fully "can engage," and is covered by a dedicated
  test asserting every other `resultado`/`camino` combination is still rejected for this
  channel.

## Open Questions

1. **Default digits.** The issue's example script uses "presione 1" for repeat. Reasonable
   defaults to pre-fill the config form (operator can still change them): repeat `1`,
   opt-out `9`? Or leave both blank with no suggested default?
2. **`maxRepeats` default.** 2 or 3? (Design leans 2 above — confirm.)
3. **Gather timeout.** Long enough to react after the message ends, short enough not to inflate
   every menu-enabled call. Proposing 5 seconds — confirm or adjust.
4. **Does a repeat press ever get a `camino`?** Design leans "no, not in v1" (decision 4) —
   confirm, since this is the one place Pedro's original note ("allow entering the message for
   repeating... the message must be enforced") could be read as wanting the repeat press
   tracked as more than a raw replay.
5. **Pencil scope.** Confirm the two screens in scope: the pre-recorded template config form
   (add the two digit+message pairs + `maxRepeats`) and the Gestión detail/Gestiones list
   (stop hiding `Resultado` for pre-recorded when set). Any other screen expected to change?
