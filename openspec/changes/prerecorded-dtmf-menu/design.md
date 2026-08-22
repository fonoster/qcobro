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

**4. What gets recorded — `camino: ENGAGED` for any DTMF press, `resultado` only for opt-out.**
(Confirmed at the design gate 2026-08-21 — reverses this decision's original draft, which had
proposed leaving `camino` untouched by a repeat press.)

- **Any configured digit pressed** (repeat or opt-out): `camino` is set to `ENGAGED`. Pressing
  _either_ digit is proof the caller was listening and interacted with the menu — a stronger
  signal than delivery alone — so both cases earn the same `camino` value. (The user's decision
  was specifically about the repeat press; opt-out setting `camino: ENGAGED` too is this
  session's inference for consistency — pressing opt-out is at least as strong an engagement
  signal as pressing repeat, and having only one of the two digits set `camino` would be an
  arbitrary asymmetry. Flag if that inference is wrong.) `ABANDONED`/`VOICEMAIL` remain
  unreachable on this channel — nothing here can detect either.
- **Opt-out pressed:** additionally sets `resultado: OPT_OUT`. This is the only new `resultado`
  value pre-recorded can ever produce, and it reuses the existing enum value and existing
  "recorded, visible, no auto-suppression" semantics — no new console concept, no new
  campaign-trigger behavior.
- **Repeat pressed (one or more times, up to the cap):** sets `camino: ENGAGED` (once, not
  re-set per repeat) but no `resultado`. The repeat count is additionally visible to operators
  as `channelData.repeatCount`.
- **No press / unrecognized digit / timeout:** `camino` and `resultado` both remain null,
  identical to today.
- **`channelCanEngage()` becomes press-conditional, not channel-fixed, for this one channel:**
  the schema-level rejection in `createContactLogSchema` currently blocks _any_ write that sets
  `camino`/`resultado` for `VOICE_PRERECORDED`. It changes to allow `camino: ENGAGED` and
  `resultado: OPT_OUT` specifically (still rejecting `ABANDONED`/`VOICEMAIL` and every
  `resultado` value other than `OPT_OUT` on this channel) — not a blanket "this channel can now
  engage," to keep the invariant as tight as before for everything except these two new cases.

**5. Prompt sequencing lives entirely in the operator's script/messages, not the platform.**

The VoiceServer plays `script`, then — only if a menu is configured — plays `repeatMessage`
and/or `optOutMessage` (whichever are set) before gathering. The platform does not compose,
translate, or number the options ("presione 1 para..."); that phrasing is the operator's job,
consistent with the issue's explicit multilingual rationale.

**6. Console changes are additive, not new components.**

`Camino` and `Resultado` already render "only when non-null" everywhere else (per the
just-synced `account-contact-log`/`web-console` model). The fix is removing
`VOICE_PRERECORDED`'s blanket exception from the "no `Camino` field and no `Resultado` row"
scenario in `web-console`'s Channel-aware Detalle de gestión and from the Gestiones list — no
new UI pattern, no Pencil component work beyond confirming the pre-recorded detail block and
list row degrade correctly with a `Camino`/`Resultado` value present. (Decision 4, as
originally drafted here, had `Camino` staying hidden for this channel; the design gate below
reversed that — a repeat press sets it too, so this decision's scope grew to match.)

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

## Design gate — resolved 2026-08-21

All open questions from the initial draft were confirmed by the user:

1. **Default digits:** leave both blank — no suggested default; the operator must deliberately
   choose both digits before the menu does anything.
2. **`maxRepeats` default:** 2.
3. **Gather timeout:** 5 seconds.
4. **Does a repeat press get a `camino`?** Yes — `camino: ENGAGED` (see decision 4, revised
   from the original draft). Extended to the opt-out press too, as this session's inference for
   consistency — flagged in decision 4 for the user to correct if that reach was wrong.
5. **Pencil scope:** confirmed as exactly the two screens proposed — the pre-recorded template
   config form (digit+message pairs + `maxRepeats`) and the Gestión detail/Gestiones list (now
   also showing `Camino` for pre-recorded, in addition to `Resultado`, when set). No other
   screen is in scope.

No questions remain open. Proceeding to Pencil (stage 1 of `/ps:ship`).

## Post-verification revision — 2026-08-22

Local live-stack testing (see the ship checkpoint) surfaced two live-call UX gaps the user
found by actually working through the flow, resolved as follows:

1. **"I have to wait for the whole message before I can press anything."** Raised as a
   barge-in request (let the caller press a digit at any point during script/menu playback,
   not only after). Investigated feasibility against the real `@fonoster/voice` SDK — `say()`
   returns a stoppable playback and `stopSay()` can interrupt one in flight, so barge-in _with
   audio interruption_ is technically buildable. The user then clarified the actual ask: the
   press should be **captured** at any time, but the **audio must keep playing
   uninterrupted** — i.e. not `stopSay()`-based barge-in. That reframing pointed at
   `sgather` (`@fonoster/common`'s `StreamGatherSource`/`StreamGatherPayload`, streaming
   per-digit payloads via a callback rather than one bounded `gather()` call) as a cleaner fit,
   since it sidesteps having to guess a combined "script duration + grace window" timeout for a
   single `gather()` call. **Decision: dropped entirely, not deferred.** The user reconsidered
   mid-investigation and confirmed the existing after-message gather is sufficient — "we can
   give them the option at the end to reply, and that should be enough." No `sgather` work was
   started; noted here only so a future reader doesn't rediscover the same investigation from
   scratch if barge-in comes up again.
2. **"I opted out but never got a confirmation — I expected something like 'we've removed you
   from the list.'"** Real gap, fixed: added `optOutConfirmationMessage`, a sixth DTMF field
   on `VoicePrerecordedConfig`, played once the opt-out digit is detected and before hangup.
   Required whenever `optOutDigit` is set, on the same terms as `optOutMessage` — the
   established "if you turn on a digit, you author its full experience" rule extends
   naturally to the digit's outcome, not just its invitation. `repeatDigit` gets no equivalent
   confirmation — replaying the script _is_ its own confirmation, and the user's complaint was
   specifically about the terminal, no-further-feedback opt-out action.
