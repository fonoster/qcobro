## 1. Code (already shipped, verify only)

- [x] 1.1 `GestionDetail.tsx` plays `recordingUrl` for both `VOICE_AI` and
      `VOICE_PRERECORDED`, unconditional on `delivery`.
- [x] 1.2 Muted "Grabación no disponible" unavailable state shown for both voice channels
      when no recording resolves.
- [x] 1.3 `GET /api/voice/tts` and the ElevenLabs client/cache/`config.tts` schema
      removed.
- [x] 1.4 Pre-recorded script card kept, retitled "Guion reproducido"/"Played script".

## 2. Docs (this change)

- [x] 2.1 Update `DELIVERABILITY.md` §4: pre-recorded now has an audio player (the real
      recording); it never synthesizes speech to represent what was said.

## 3. Archive

- [x] 3.1 Run `/opsx:archive` to sync the `prerecorded-audio` and `web-console` delta
      specs into `openspec/specs/**`.
- [x] 3.2 After archiving, write a real `## Purpose` for
      `openspec/specs/prerecorded-audio/spec.md` (currently the literal placeholder "TBD - created by archiving change voice-integration") — not part of the delta
      mechanism, since Purpose isn't a requirement.
