## MODIFIED Requirements

### Requirement: Voice estimate and settlement

A voice dispatch — for **either** voice channel, `VOICE_AI` or `VOICE_PRERECORDED` — SHALL debit
an estimated amount at dispatch time (per billing-enforcement) and, when the call completes, SHALL
be settled by a signed adjustment entry so the net ledger effect equals the increment-billed
amount for the answered duration. A call reported as never answered SHALL settle to a net charge
of zero. The completion signal differs by channel — Voz IA via its events-hook, pre-recorded
in-process from the co-located VoiceServer — but the estimate→settle accounting is identical.

#### Scenario: Longer call settles upward

- **WHEN** a voice-AI call was debited at a 60-second estimate and completes with 95 answered
  seconds under `"15/15"`
- **THEN** an adjustment is written such that the net charge equals 105 billed seconds at the
  plan rate

#### Scenario: Unanswered call settles to zero

- **WHEN** a voice call was debited at the estimate and completes unanswered
- **THEN** the settlement adjustment fully reverses the estimated debit

#### Scenario: Pre-recorded call settles on its answered duration

- **WHEN** a `VOICE_PRERECORDED` call was debited at the dispatch estimate and the co-located
  VoiceServer reports it answered for 22 seconds under `"15/15"`
- **THEN** a settlement adjustment is written so the net charge equals 30 billed seconds at the
  `voicePrerecorded` rate
