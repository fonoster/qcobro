# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.10.0](https://github.com/fonoster/qcobro/compare/v1.9.0...v1.10.0) (2026-06-30)

### Features

- **whatsapp:** add WhatsApp channel server foundation (§2–§6.1) ([51211f3](https://github.com/fonoster/qcobro/commit/51211f3b8af1cd7fb45e0b2ded40262915606548)), closes [#5](https://github.com/fonoster/qcobro/issues/5)

# [1.9.0](https://github.com/fonoster/qcobro/compare/v1.8.0...v1.9.0) (2026-06-29)

### Bug Fixes

- **api:** stop resending Voz IA system prompt as call metadata ([0d66d18](https://github.com/fonoster/qcobro/commit/0d66d18b34d0f353f02d96599d8784f0f372a547))

### Features

- **common:** add isDue outreach variable and document template variables ([ed7a511](https://github.com/fonoster/qcobro/commit/ed7a51161b758d2337055028f7adf52f22f7ae56))

## [1.5.4](https://github.com/fonoster/qcobro/compare/v1.5.3...v1.5.4) (2026-06-28)

### Bug Fixes

- **e2e:** supply fonoster voices in CI config; enable campaigns + console specs ([2ff90ab](https://github.com/fonoster/qcobro/commit/2ff90aba4da71f7e6d902aacff753ea5a9411950))

# [1.5.0](https://github.com/fonoster/qcobro/compare/v1.4.1...v1.5.0) (2026-06-28)

### Features

- **profile-language:** per-user language preference + i18n hygiene sweep ([dbddb9c](https://github.com/fonoster/qcobro/commit/dbddb9c7915103afc339ec9d695b27c97d7634ce))

# [1.4.0](https://github.com/fonoster/qcobro/compare/v1.3.2...v1.4.0) (2026-06-28)

### Features

- **workspace-settings:** collect currency + timezone at workspace creation ([682ae8f](https://github.com/fonoster/qcobro/commit/682ae8f5fcf2045564c0dd5ac0e8f38fa736ed4a))

## [1.3.2](https://github.com/fonoster/qcobro/compare/v1.3.1...v1.3.2) (2026-06-28)

**Note:** Version bump only for package @qcobro/common

## [1.3.1](https://github.com/fonoster/qcobro/compare/v1.3.0...v1.3.1) (2026-06-28)

### Bug Fixes

- **timezone:** contact-log REST uses workspace tz; default is a constant ([1b86419](https://github.com/fonoster/qcobro/commit/1b86419fc98722d0c1174ce9f1bdf19848b35dd5))

# [1.3.0](https://github.com/fonoster/qcobro/compare/v1.2.3...v1.3.0) (2026-06-28)

### Features

- **workspace-settings:** per-workspace currency + timezone (off Identity) ([c1516a3](https://github.com/fonoster/qcobro/commit/c1516a3d306e2b2a906d9ae476fb27f23887d5ae))

# [1.2.0](https://github.com/fonoster/qcobro/compare/v1.1.4...v1.2.0) (2026-06-28)

### Features

- **payment-promises:** outcomes + PaymentPromise worklist, agent-based outreach ([6c620f8](https://github.com/fonoster/qcobro/commit/6c620f8a80c65a7178b0716b825a7d4ebb4077f7))

# 1.1.0 (2026-06-28)

### Bug Fixes

- **channel-dispatch:** allow empty firstMessage for VOICE_AI; non-destructive engine test ([71e17a6](https://github.com/fonoster/qcobro/commit/71e17a6a32d8353e9d428e5763e937408df066df))
- **channel-dispatch:** pre-recorded voice has no firstMessage either ([ebc8e90](https://github.com/fonoster/qcobro/commit/ebc8e9049b765388e8e0e7505dccef22d4dde875))
- **email:** hydrate inbound body from received-emails api; strip quoted history ([ddcbdb1](https://github.com/fonoster/qcobro/commit/ddcbdb170953cb9428d92a0cc385d5b83eb43cfd))
- **voice:** provision AUTOPILOT apps with required conversation settings ([c92a8aa](https://github.com/fonoster/qcobro/commit/c92a8aa52c30e2c8f3f78145dec17a99b72282cd))
- **webapp:** drop unused fromName/fromEmail from EMAIL agent form; add Resend status badge ([625c3c8](https://github.com/fonoster/qcobro/commit/625c3c8300d275f9f1982353bdf87112a9f03fa2))
- **workspaces:** wire invite acceptance to Identity HTTP bridge ([5b9fc40](https://github.com/fonoster/qcobro/commit/5b9fc40c57cd8d692d2711c1483bbd158e01aa54))

### Features

- **agent-templates:** per-channel agents, voices-from-config, Fonoster Voz IA sync ([6a8065d](https://github.com/fonoster/qcobro/commit/6a8065d27f8954aa5c5faf7ab34553dccefda5fc))
- **ai-insights:** transcript-based AI analysis + Voz IA wiring ([4ed7d2e](https://github.com/fonoster/qcobro/commit/4ed7d2e0faf2af9d8ff7966c687c346183b05184))
- **api-keys:** workspace API key management ([30dd25d](https://github.com/fonoster/qcobro/commit/30dd25d52e1083afb66c7bd323b10d0ac193425a))
- **api,webapp:** delete-workspace — ownerProcedure and WorkspaceSettings UI ([2542443](https://github.com/fonoster/qcobro/commit/2542443d6cdf4c9a6b2587e3380de9ea3e9f8263))
- **api,webapp:** profile-management — profile router and Profile page ([5850ec6](https://github.com/fonoster/qcobro/commit/5850ec6e777a987c559f6ab94a15725bc998820f))
- **api:** add contact-verification and OAuth auth procedures ([b6b70c3](https://github.com/fonoster/qcobro/commit/b6b70c35dd8063ccbdc6e429ded21aa96154928d))
- **api:** complete auth-and-workspaces change — password reset, resend invite, accept-invite UI ([09c557b](https://github.com/fonoster/qcobro/commit/09c557b00dfee7de725e45cfc5f6e5f61e91f44d))
- **apiserver:** add auth router (signup, login, refresh, logout) ([9fd50e0](https://github.com/fonoster/qcobro/commit/9fd50e0a32c92ca6bcdf0c053f7050f16921b42b))
- **apiserver:** add workspace create/list/get (Group 5 core) ([99de39c](https://github.com/fonoster/qcobro/commit/99de39c29c692fd2760053c3bb7f196e11c1a05b))
- **campaigns-engine:** propose change + config/contracts (group 1) ([6ffd70d](https://github.com/fonoster/qcobro/commit/6ffd70df34cf0a3f33060243eadb1b7460e440eb))
- **campaigns-engine:** wiring + cleanup (groups 7/9) ([828056d](https://github.com/fonoster/qcobro/commit/828056d091f419bafc5d675a6f0bd92e67bf9eb9))
- **campaigns:** campaigns-core — lifecycle, days-of-week, edit modal, specs synced ([d1e75cd](https://github.com/fonoster/qcobro/commit/d1e75cd9e065a1556811ee0abf94c4e2ab569e20))
- **campaigns:** checkpoint campaigns-core WIP before refinement ([2b3e339](https://github.com/fonoster/qcobro/commit/2b3e339913ab4de37152ed04e5aaf0d90fb247c4))
- **channel-dispatch:** outreach trigger layer (Fonoster voice + Twilio SMS) ([56a4b9e](https://github.com/fonoster/qcobro/commit/56a4b9e4c7c9267f0bfbad42b4b37fff74b6b8fb))
- **common:** add validated-function utilities and conventions guide ([a60bab9](https://github.com/fonoster/qcobro/commit/a60bab99affd9290602512e5921632c4a1f9f70f))
- **console:** config-driven announcement banner; flag unimplemented data ([01d8977](https://github.com/fonoster/qcobro/commit/01d89775fa547766521c5be5c15ba429bf5a655c))
- **console:** refinement + cleanup pass ([78dc3e5](https://github.com/fonoster/qcobro/commit/78dc3e58f2a4eaede4bf10a9d2a551b3c426d9ee))
- **email-channel:** inbound autopilot — webhook, decision loop, reply cap ([67b6a85](https://github.com/fonoster/qcobro/commit/67b6a8515e75f8ca178293755bffa540a2a3d139))
- **email-channel:** outbound email + engine integration (Resend) ([391d3d0](https://github.com/fonoster/qcobro/commit/391d3d0caf3440d4f41568d0c48ec37c7ec76d36))
- **email-channel:** spec + contracts for bidirectional email (Resend autopilot) ([6c2461c](https://github.com/fonoster/qcobro/commit/6c2461ced535cc1b1eb4a7f9eb2a3dcd989dbbe5))
- **email:** bidirectional email channel end-to-end ([b49a442](https://github.com/fonoster/qcobro/commit/b49a442104841023f3507a6c33cf85dfe689bf12))
- **gestiones:** add voz IA channel webhook and rich detail panel ([824671f](https://github.com/fonoster/qcobro/commit/824671f0da22dcc9ec16a610618925f96e28d2c8))
- identity now from the published fonoster identity mod ([9a6eaea](https://github.com/fonoster/qcobro/commit/9a6eaeaed20f51ea7a4846fe116735aeecdcc6e5))
- **manual-outreach:** carteras reach-out modal + campaign-derived dispatch ([367db2d](https://github.com/fonoster/qcobro/commit/367db2d370c893317042b76239acb7d39c3e69f7))
- **portfolios:** portfolio management, status enums, currency, and row actions ([6b6bac9](https://github.com/fonoster/qcobro/commit/6b6bac914d85f5140da0abfaa84bd682686364e3))
- scaffold Qcobro app monorepo ([d5a7507](https://github.com/fonoster/qcobro/commit/d5a7507016d27cc2f76ece0c6aaeff33186d8da0))
- scaffold spec-driven monorepo foundation ([1a17d89](https://github.com/fonoster/qcobro/commit/1a17d89dffe686032caafe1c09be50053286e48b))
- **sdk:** add @qcobro/sdk with portfolios, API-key auth, and auto-refresh ([324405e](https://github.com/fonoster/qcobro/commit/324405e9922bf70ccd57088122098c6c2d8de2e7))
- **voice:** embedded Fonoster VoiceServer for pre-recorded (external) agents ([00e581e](https://github.com/fonoster/qcobro/commit/00e581e78c503509ad7af4cade0b29b226a78a60))
- **voice:** make pre-recorded audio permanent and spec the events-hook ([8b03fdb](https://github.com/fonoster/qcobro/commit/8b03fdbbbd84cc4233578ae94e37a9a364171584))
- **voice:** pre-recorded via shared external app ref + Say playback ([e156292](https://github.com/fonoster/qcobro/commit/e15629223914a1141025a1804aa184222c3f244e))
- **webapp:** implement Pencil UI — login brand panel, workspace picker, sidebar redesign ([e34ef12](https://github.com/fonoster/qcobro/commit/e34ef123b68941a007304316f3c0135f50a69cbd))
- **workspaces:** rename + console navigation (workspace-management) ([46acf86](https://github.com/fonoster/qcobro/commit/46acf86d32a09d3cf4474818f4950e35776bef01))
