## Context

The code side of this change already shipped in two prior commits on this branch:

- `GestionDetail.tsx` widened its recording player `Section` from `VOICE_AI`-only to
  both voice channels, driven by `g.recordingUrl` (already resolved server-side for both
  channels by `resolveRecordingUrl`, from `channelData.recordingFile`/`recordingUrl`).
  The unavailable state is now a shared muted card (mic-off icon + explanation) instead
  of the old one-line "unavailable" text nested only in the Voz IA card.
- The whole TTS-for-playback subsystem was deleted: `GET /api/voice/tts`,
  `elevenLabsTts.ts`, `ttsCache.ts` (+ its test), `config.tts` (schema, defaults, type) in
  `@qcobro/common`, the `tts` block in `config/qcobro.example.json`, and the
  README/`httpTimeouts.ts` references to it.

This artifact set exists to bring `openspec/specs/**` and `DELIVERABILITY.md` back in
sync with that shipped behavior — a previous PR skipped the spec-sync step for a related
change, and this proposal exists partly to avoid repeating that mistake.

`ttsProductRefForVoice` and the `fonoster.voices` catalog are unrelated and untouched:
that is what sets the `productRef` on a Voz IA AUTOPILOT application so Fonoster itself
speaks with the right voice on a **live call**. Pre-recorded dispatch never calls it —
`dispatchOutreach.ts` sends only the rendered script text as call metadata, and the
co-located VoiceServer speaks it via `res.say()` using whatever TTS product the
Fonoster-side EXTERNAL application is configured with.

## Goals / Non-Goals

**Goals:**

- Make `openspec/specs/prerecorded-audio/spec.md` and
  `openspec/specs/web-console/spec.md` describe the shipped behavior: pre-recorded plays
  the real call recording, never a synthesized re-narration.
- State the "no synthesis for call-recording playback" rule as an explicit SHALL NOT, not
  an implied omission — this is the property the whole change exists to protect against
  regressing.
- Fix a pre-existing spec/code mismatch discovered while touching this requirement (the
  `Camino` label text in a `web-console` scenario) so the delta doesn't leave a known-bad
  assertion sitting next to a change unrelated to it.
- Correct `DELIVERABILITY.md` §4, a design-notes doc read alongside these specs.

**Non-Goals:**

- No further code changes — the implementation is already shipped; this is a docs/spec
  sync.
- No change to the DTMF menu requirement or its own "SHALL NOT synthesize... spoken
  options" line — that is about live-call audio (the menu prompts), a different surface
  from the call-recording playback this change concerns.
- No change to `ttsProductRefForVoice`, the voice catalog, or the live-call voice path.

## Decisions

- **One replacement requirement, not three.** The three deleted requirements
  (playable-as-audio, provider-configured, cache-bounded) described a synthesis pipeline
  that no longer exists; a single requirement describing "plays the resolved recording,
  degrades to an explicit unavailable state, never synthesizes" replaces all three rather
  than three requirements that would now describe absence.
- **Player visibility is independent of `delivery`.** The replacement requirement states
  the player shows whenever a recording resolves, regardless of `delivery` — deliberately
  not restated as "only when `DELIVERED`". A call that connected and played nothing
  (`FAILED`/`UNREACHABLE`, per the "Pre-recorded call completion" requirement) is exactly
  the case an operator most needs to listen to, and the code's `recordingUrl ? … : …`
  branch never gates on delivery either.
- **The prohibition is explicit, not implied.** "SHALL NOT synthesize audio to represent
  what was said on a call" is written as its own sentence rather than left to be inferred
  from the absence of a synthesis requirement — this is the property most likely to
  regress silently (e.g. a future feature re-adding a "preview" endpoint) and the spec
  should make an attempt to reintroduce it a visible violation, not a gap.
- **`DELIVERABILITY.md` is edited directly**, not through the OpenSpec archive step — it
  is a design-notes doc, not a spec file under `openspec/specs/`.

## Risks / Trade-offs

- [Spec drift between what actually ships and this delta, if a future change to the
  player logic isn't accompanied by a spec update] → mitigated only by process (the
  `/ps:ship` loop's spec-reconcile stage); no automated check enforces it.
- [The `web-console` `Camino` label fix is bundled into a change whose subject is TTS
  removal, which could look unrelated in review] → called out explicitly in the proposal
  and this design doc as a pre-existing mismatch found while editing the same
  requirement, not a scope-creep addition.

## Migration Plan

Docs/spec-only change — nothing to deploy or roll back. Archiving syncs the delta specs
into `openspec/specs/prerecorded-audio/spec.md` and `openspec/specs/web-console/spec.md`.

## Open Questions

None.
