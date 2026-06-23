## 1. Voz IA events-hook (encode existing behavior)

- [x] 1.1 `fonoster.webhookBaseUrl` config (optional URL)
- [x] 1.2 Voice-app sync registers the autopilot events-hook (`<base>/api/voice/events`,
      all events) when the base URL is set; no hook otherwise
- [x] 1.3 `POST /api/voice/events` correlates events to the gestión by call ref

## 2. Pre-recorded audio (make permanent)

- [x] 2.1 Optional `tts` config in `qcobro.json` (`provider`, `apiKey`, `model`); documented
      in `qcobro.example.json`
- [x] 2.2 TTS service reads `tts.apiKey`/`tts.model` with fallback to `ELEVENLABS_API_KEY` /
      the Fonoster integrations file; voice from `fonoster.voices`
- [x] 2.3 `GET /api/voice/tts` endpoint (cached); 503 when unconfigured
- [x] 2.4 Pre-grabada detail plays the synthesized audio via the `/api` proxy
- [x] 2.5 Remove the "TEMPORARY/demo" framing from the TTS code/comments

## 3. Cleanup

- [x] 3.1 Delete `scripts/smoke-insight.ts` (smoke test no longer needed)

## 4. Follow-ups (tracked, not in this change)

- [ ] 4.1 Secure `POST /api/voice/events` (auth/signing + workspace scoping)
- [ ] 4.2 Optionally persist generated pre-recorded audio instead of in-memory cache
