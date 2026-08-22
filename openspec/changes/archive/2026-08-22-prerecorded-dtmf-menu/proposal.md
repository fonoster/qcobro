## Why

Voz pregrabada plays its script once and hangs up
(`mods/apiserver/src/voice/voiceServer.ts`: answer → say → hangup). If the account holder
misses the amount or the callback number, the call is wasted with no way to recover it, and
there is no in-call way for someone to ask to be left alone — both raised in
[issue #88](https://github.com/fonoster/qcobro/issues/88).

## What Changes

- Pre-recorded templates gain an **optional DTMF menu**: up to two independently configurable
  single-digit options — **repeat** (replays the script) and **opt-out** — each off by default.
  An operator who enables a digit must also enter its spoken prompt; the two digits, when both
  enabled, must differ.
- After the script plays, the VoiceServer gathers one DTMF digit (`response.gather({ source:
DTMF, maxDigits: 1, timeout })`) only when at least one digit is configured for that template.
  Anything else — an unconfigured digit, no press, or a timeout — hangs up exactly as today.
- Repeats are capped (see design.md) so a caller cannot loop the call indefinitely; pre-recorded
  voice is billed per minute in 15-second increments.
- Pressing the opt-out digit records `resultado: OPT_OUT` on the gestión — the same value and
  the same "recorded, visible, not auto-suppressing" semantics EMAIL/WHATSAPP/VOICE_AI already
  use. This is the **first** inbound signal `VOICE_PRERECORDED` can ever produce, which narrows
  an existing invariant in `account-contact-log` (see Modified Capabilities).
- Voz IA (autopilot) is unaffected — the caller can already ask the AI agent to repeat. SMS,
  Email, and WhatsApp are unaffected.

## Capabilities

### New Capabilities

_(none — this extends existing voice/contact-log/console capabilities rather than introducing a
new one)_

### Modified Capabilities

- `agent-templates`: `VoicePrerecordedConfig` gains the DTMF menu fields (repeat digit +
  message, opt-out digit + message, both optional) and their validation (digits differ when
  both set; a message is required whenever its digit is set).
- `prerecorded-audio`: the VoiceServer plays the script, then — only when the template has at
  least one digit configured — gathers a DTMF digit and acts on it (replay, opt-out, or hang up
  on anything else/timeout), bounded by a repeat cap.
- `account-contact-log`: narrows the `VOICE_PRERECORDED` "no inbound path, `camino`/`resultado`
  always null" rule to "no inbound path **unless a DTMF menu is configured and the caller
  presses a configured digit**" — the opt-out press sets `resultado: OPT_OUT`; when no menu is
  configured, or the caller presses nothing/an unrecognized key, behavior is unchanged.
- `web-console`: the Gestión detail and Gestiones list currently hide `Camino`/`Resultado` for
  every `VOICE_PRERECORDED` row unconditionally. They need to show `Resultado` when one was
  recorded (i.e. an opt-out press occurred), matching the existing "hidden only when null" rule
  the other body-level rows already follow — no new UI concept, just removing the pre-recorded
  channel's blanket exception.

## Impact

- `mods/common`: `VoicePrerecordedConfig` schema (repeat/opt-out digit + message fields), the
  dispatch-time script-render payload (needs the configured digits/prompts available to the
  VoiceServer), and the `resultado`-setting completion input.
- `mods/apiserver`: `voiceServer.ts` (gather + branch on digit), the agent-template
  create/update validated functions (new field validation), `recordPrerecordedOutcome` (or its
  successor) to accept an optional `resultado`.
- `mods/webapp`: the pre-recorded template config form (two optional digit+message pairs), the
  Gestión detail panel and Gestiones list/table (stop hiding `Resultado` for pre-recorded).
- Docs: the voz pregrabada section of the agent-templates guide — what the caller can press,
  and that the operator must say so in the script for it to be discoverable.
