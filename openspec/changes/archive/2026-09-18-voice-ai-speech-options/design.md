## Context

`FonosterVoiceApplicationClient.buildRequest()` builds each AUTOPILOT application from the
template plus deployment defaults (`qcobro.json` `autopilot` block):
`speechToText.config = { model: autopilot.sttModel, languageCode: input.language }`, and
`conversationSettings` spreads `autopilotTemplate.json`, which carried `allowUserBargeIn: false`.
The template `language` has no other server-side consumer (pre-recorded dispatch does not read
it; the voice catalog is not filtered by it).

Deepgram: Nova-3 and Nova-2 accept Spanish as `es` or `es-419`, and `multi` (Nova-3: 10
languages; Nova-2: English + Spanish). Fonoster's `stt.deepgram` validator accepts `multi` only
with `nova-3`/`nova-2` (fonoster/fonoster#910). QCobro's deployment `sttModel` is `nova-3`.

## Decisions

- **`multi` is a language value, not a separate switch.** A first iteration added a
  `multilingualStt` boolean; replaced because the language field is exactly what Deepgram
  receives, so one control is simpler and the option label carries the guidance.
- **`multi` only for `VOICE_AI`.** Pre-recorded calls recognize no speech. Switching a new
  template's type away from `VOICE_AI` resets a `multi` language to the default.
- **`es-419` replaces `es`.** Default for new templates; `es` is dropped from the options with
  no data migration (operator decision: no backwards compatibility).
- **Model fallback for `multi`:** deployment `sttModel` if it is `nova-3`/`nova-2`, else
  `nova-3`, so a template never fails to sync only because of the deployment model.
- **`allowUserBargeIn` leaves `autopilotTemplate.json`**: `buildRequest()` sets it from the
  template, `evaluate()` sets `false`, one source per path (mirrors how `idleOptions` left).
- **Switches for on/off settings** in forms; checkboxes stay for multi-select lists.

## Risks / Trade-offs

- `multi` trades some single-language accuracy for coverage; opt-in per agent.
- Barge-in makes agents interruptible by noise and side conversation; off by default.
- Selecting `multi` before the Fonoster deployment has #910 fails the sync (visible, retryable).
