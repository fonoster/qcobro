# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.36.1](https://github.com/fonoster/qcobro/compare/v1.36.0...v1.36.1) (2026-08-26)

### Bug Fixes

- **webapp:** refresh the active screen when the workspace switches ([#137](https://github.com/fonoster/qcobro/issues/137)) ([0ea6169](https://github.com/fonoster/qcobro/commit/0ea6169c0e6e653ca6a52aebeffc4c88a6cce767))

# [1.36.0](https://github.com/fonoster/qcobro/compare/v1.35.2...v1.36.0) (2026-08-26)

### Features

- **api-keys:** show createdAt and allow setting expiry when creating a key ([#136](https://github.com/fonoster/qcobro/issues/136)) ([611641d](https://github.com/fonoster/qcobro/commit/611641d763b6d34eab99eb7e6fed76ae4b3f9856)), closes [fonoster/fonoster#877](https://github.com/fonoster/fonoster/issues/877) [fonoster/fonoster#877](https://github.com/fonoster/fonoster/issues/877)

## [1.35.2](https://github.com/fonoster/qcobro/compare/v1.35.1...v1.35.2) (2026-08-25)

### Bug Fixes

- **webapp:** show all workspaces on the post-login landing page ([#135](https://github.com/fonoster/qcobro/issues/135)) ([4aca557](https://github.com/fonoster/qcobro/commit/4aca55720644ef07f5ee45bcfc0528fab2dcea73))

## [1.35.1](https://github.com/fonoster/qcobro/compare/v1.35.0...v1.35.1) (2026-08-25)

**Note:** Version bump only for package @qcobro/webapp

# [1.35.0](https://github.com/fonoster/qcobro/compare/v1.34.4...v1.35.0) (2026-08-25)

**Note:** Version bump only for package @qcobro/webapp

## [1.34.4](https://github.com/fonoster/qcobro/compare/v1.34.3...v1.34.4) (2026-08-25)

**Note:** Version bump only for package @qcobro/webapp

## [1.34.3](https://github.com/fonoster/qcobro/compare/v1.34.2...v1.34.3) (2026-08-25)

**Note:** Version bump only for package @qcobro/webapp

## [1.34.2](https://github.com/fonoster/qcobro/compare/v1.34.1...v1.34.2) (2026-08-25)

**Note:** Version bump only for package @qcobro/webapp

## [1.34.1](https://github.com/fonoster/qcobro/compare/v1.34.0...v1.34.1) (2026-08-24)

**Note:** Version bump only for package @qcobro/webapp

# [1.34.0](https://github.com/fonoster/qcobro/compare/v1.33.0...v1.34.0) (2026-08-22)

### Features

- **voice:** add an opt-out confirmation message to the dtmf menu ([#119](https://github.com/fonoster/qcobro/issues/119)) ([3377ae4](https://github.com/fonoster/qcobro/commit/3377ae468ba95aa6bc6b4f64b8f0578dd50a9f21)), closes [#117](https://github.com/fonoster/qcobro/issues/117)

# [1.33.0](https://github.com/fonoster/qcobro/compare/v1.32.4...v1.33.0) (2026-08-22)

### Features

- **voice:** add optional DTMF repeat/opt-out menu to voz pregrabada ([#117](https://github.com/fonoster/qcobro/issues/117)) ([4e8896a](https://github.com/fonoster/qcobro/commit/4e8896a3b9891cfedb21f512eecd9acc6dcd5543)), closes [#88](https://github.com/fonoster/qcobro/issues/88) [#88](https://github.com/fonoster/qcobro/issues/88)

## [1.32.3](https://github.com/fonoster/qcobro/compare/v1.32.2...v1.32.3) (2026-08-21)

### Bug Fixes

- **campaigns:** reject inverted contact windows instead of dispatching to nobody ([#113](https://github.com/fonoster/qcobro/issues/113)) ([c84decd](https://github.com/fonoster/qcobro/commit/c84decd73a91e67c2fdea803d8d0d042d6813695)), closes [#102](https://github.com/fonoster/qcobro/issues/102)

## [1.32.1](https://github.com/fonoster/qcobro/compare/v1.32.0...v1.32.1) (2026-08-21)

### Bug Fixes

- **webapp:** align KPI card notes and make the period control usable ([#111](https://github.com/fonoster/qcobro/issues/111)) ([0e4d61c](https://github.com/fonoster/qcobro/commit/0e4d61c6225e770802a58421d53b15efb7067baf))

# [1.32.0](https://github.com/fonoster/qcobro/compare/v1.31.0...v1.32.0) (2026-08-21)

### Features

- **webapp:** window the contact rate to a period and count accounts, not attempts ([#110](https://github.com/fonoster/qcobro/issues/110)) ([0908806](https://github.com/fonoster/qcobro/commit/090880677f70acf32fe4d26392c4c7ef6bd494b7)), closes [#109](https://github.com/fonoster/qcobro/issues/109)

# [1.31.0](https://github.com/fonoster/qcobro/compare/v1.30.1...v1.31.0) (2026-08-21)

**Note:** Version bump only for package @qcobro/webapp

## [1.30.1](https://github.com/fonoster/qcobro/compare/v1.30.0...v1.30.1) (2026-08-20)

### Bug Fixes

- **webapp:** default max attempts per day to 1 on new campaigns ([#105](https://github.com/fonoster/qcobro/issues/105)) ([bcf36ed](https://github.com/fonoster/qcobro/commit/bcf36ede80076eea50916db5228bda6b5e6466b9))

# [1.30.0](https://github.com/fonoster/qcobro/compare/v1.29.3...v1.30.0) (2026-08-20)

### Features

- **api:** split contact-log outcome into entrega, camino and resultado ([#104](https://github.com/fonoster/qcobro/issues/104)) ([f480826](https://github.com/fonoster/qcobro/commit/f480826acf6ffe7e8e6db2381c17f6af284f57ea)), closes [#101](https://github.com/fonoster/qcobro/issues/101) [#95](https://github.com/fonoster/qcobro/issues/95) [#96](https://github.com/fonoster/qcobro/issues/96) [#94](https://github.com/fonoster/qcobro/issues/94) [#95](https://github.com/fonoster/qcobro/issues/95) [#100](https://github.com/fonoster/qcobro/issues/100) [#101](https://github.com/fonoster/qcobro/issues/101) [#103](https://github.com/fonoster/qcobro/issues/103) [#98](https://github.com/fonoster/qcobro/issues/98) [#99](https://github.com/fonoster/qcobro/issues/99)

## [1.29.3](https://github.com/fonoster/qcobro/compare/v1.29.2...v1.29.3) (2026-08-19)

### Bug Fixes

- **webapp:** show dashboard KPI money as whole units, no cents ([#99](https://github.com/fonoster/qcobro/issues/99)) ([2f8b4d4](https://github.com/fonoster/qcobro/commit/2f8b4d4536a4f427aca7212fce770f618fb59383))

## [1.29.2](https://github.com/fonoster/qcobro/compare/v1.29.1...v1.29.2) (2026-08-19)

### Bug Fixes

- **webapp:** round money to cents before choosing a fraction-digit format ([#98](https://github.com/fonoster/qcobro/issues/98)) ([339bd1e](https://github.com/fonoster/qcobro/commit/339bd1e996cd2c8372750c4085f4b26b05f33574))

## [1.29.1](https://github.com/fonoster/qcobro/compare/v1.29.0...v1.29.1) (2026-08-19)

### Bug Fixes

- **webapp:** format money with workspace locale, not generic "es" ([#97](https://github.com/fonoster/qcobro/issues/97)) ([e0ac6bd](https://github.com/fonoster/qcobro/commit/e0ac6bd257ef8e6740f719d74f5df0877d1b55a7)), closes [#94](https://github.com/fonoster/qcobro/issues/94)

# [1.29.0](https://github.com/fonoster/qcobro/compare/v1.28.2...v1.29.0) (2026-08-19)

**Note:** Version bump only for package @qcobro/webapp

## [1.28.2](https://github.com/fonoster/qcobro/compare/v1.28.1...v1.28.2) (2026-08-19)

**Note:** Version bump only for package @qcobro/webapp

## [1.28.1](https://github.com/fonoster/qcobro/compare/v1.28.0...v1.28.1) (2026-08-13)

**Note:** Version bump only for package @qcobro/webapp

# [1.28.0](https://github.com/fonoster/qcobro/compare/v1.27.1...v1.28.0) (2026-08-13)

### Features

- **common:** format outreach amounts for the workspace locale, add {{digits}} helper ([#85](https://github.com/fonoster/qcobro/issues/85)) ([e974342](https://github.com/fonoster/qcobro/commit/e974342d307716528c4510b078947ca802dcde97))

## [1.27.1](https://github.com/fonoster/qcobro/compare/v1.27.0...v1.27.1) (2026-08-03)

### Bug Fixes

- **gestiones:** generate AI insight for WhatsApp threads, fix mislabeled section ([#81](https://github.com/fonoster/qcobro/issues/81)) ([8755af2](https://github.com/fonoster/qcobro/commit/8755af229875e8faab24fc3ed4bfa0021cd165f8))

# [1.27.0](https://github.com/fonoster/qcobro/compare/v1.26.0...v1.27.0) (2026-08-03)

**Note:** Version bump only for package @qcobro/webapp

# [1.26.0](https://github.com/fonoster/qcobro/compare/v1.25.0...v1.26.0) (2026-07-30)

### Features

- **realtime:** stream Gestiones list and Gestión detail live over WebSocket ([#77](https://github.com/fonoster/qcobro/issues/77)) ([54b676b](https://github.com/fonoster/qcobro/commit/54b676b99ab1a43411d483c3b59682a29e5b2703)), closes [#60](https://github.com/fonoster/qcobro/issues/60)

## [1.24.1](https://github.com/fonoster/qcobro/compare/v1.24.0...v1.24.1) (2026-07-30)

**Note:** Version bump only for package @qcobro/webapp

# [1.24.0](https://github.com/fonoster/qcobro/compare/v1.23.0...v1.24.0) (2026-07-29)

### Features

- classify outreach dispatch failures, auto-pause on sustained errors ([#73](https://github.com/fonoster/qcobro/issues/73)) ([b8e3080](https://github.com/fonoster/qcobro/commit/b8e30808e3ac7dc438569cbedf4c8c093ee8b56c)), closes [#51](https://github.com/fonoster/qcobro/issues/51) [#51](https://github.com/fonoster/qcobro/issues/51)

## [1.22.1](https://github.com/fonoster/qcobro/compare/v1.22.0...v1.22.1) (2026-07-28)

**Note:** Version bump only for package @qcobro/webapp

# [1.22.0](https://github.com/fonoster/qcobro/compare/v1.21.0...v1.22.0) (2026-07-16)

**Note:** Version bump only for package @qcobro/webapp

# [1.21.0](https://github.com/fonoster/qcobro/compare/v1.20.5...v1.21.0) (2026-07-16)

### Features

- **webapp:** make the account external ID copyable in gestión-detail metadata ([#67](https://github.com/fonoster/qcobro/issues/67)) ([6ea93a0](https://github.com/fonoster/qcobro/commit/6ea93a06bddbc8da8f06c4aedd33f2330c6162f1))

## [1.20.5](https://github.com/fonoster/qcobro/compare/v1.20.4...v1.20.5) (2026-07-16)

**Note:** Version bump only for package @qcobro/webapp

## [1.20.2](https://github.com/fonoster/qcobro/compare/v1.20.1...v1.20.2) (2026-07-16)

**Note:** Version bump only for package @qcobro/webapp

# [1.20.0](https://github.com/fonoster/qcobro/compare/v1.19.6...v1.20.0) (2026-07-16)

### Features

- **webapp:** show Gestión ID in gestión-detail metadata ([#58](https://github.com/fonoster/qcobro/issues/58)) ([2d564b6](https://github.com/fonoster/qcobro/commit/2d564b6c89f18cdf9cee816a37f602655d49a067))

## [1.19.6](https://github.com/fonoster/qcobro/compare/v1.19.5...v1.19.6) (2026-07-15)

### Bug Fixes

- **webapp:** generalize Voz IA gestión-detail call title ([#57](https://github.com/fonoster/qcobro/issues/57)) ([f90bab3](https://github.com/fonoster/qcobro/commit/f90bab348bedb1b4ad65b244075db861e7b98a4a))

## [1.19.4](https://github.com/fonoster/qcobro/compare/v1.19.3...v1.19.4) (2026-07-14)

### Bug Fixes

- **whatsapp:** correct template variable preview and Meta named-parameter mapping ([#53](https://github.com/fonoster/qcobro/issues/53)) ([9951417](https://github.com/fonoster/qcobro/commit/995141746127a390c238fb22982c1a42edddecf9))

## [1.19.3](https://github.com/fonoster/qcobro/compare/v1.19.2...v1.19.3) (2026-07-14)

### Bug Fixes

- **webapp:** remove double border on WhatsApp initial message ([#50](https://github.com/fonoster/qcobro/issues/50)) ([b8e1fca](https://github.com/fonoster/qcobro/commit/b8e1fcaf0079d880d629fd500fd23ce19ea86805))

## [1.19.2](https://github.com/fonoster/qcobro/compare/v1.19.1...v1.19.2) (2026-07-13)

### Bug Fixes

- **whatsapp:** validate connectivity, retry template fetch, look up by name, support manual outreach ([#46](https://github.com/fonoster/qcobro/issues/46)) ([a1d1dda](https://github.com/fonoster/qcobro/commit/a1d1dda2f1c3b8193721a7d0244645dfb50748d3)), closes [#13](https://github.com/fonoster/qcobro/issues/13) [#14](https://github.com/fonoster/qcobro/issues/14)

## [1.19.1](https://github.com/fonoster/qcobro/compare/v1.19.0...v1.19.1) (2026-07-13)

**Note:** Version bump only for package @qcobro/webapp

# [1.19.0](https://github.com/fonoster/qcobro/compare/v1.18.0...v1.19.0) (2026-07-13)

**Note:** Version bump only for package @qcobro/webapp

# [1.17.0](https://github.com/fonoster/qcobro/compare/v1.16.0...v1.17.0) (2026-07-13)

### Features

- **webapp:** add branding to auth pages, fix header/CTA inconsistencies ([#4](https://github.com/fonoster/qcobro/issues/4)) ([#40](https://github.com/fonoster/qcobro/issues/40)) ([d16ab63](https://github.com/fonoster/qcobro/commit/d16ab637c89340012012adae2f883d1e4ab18220))

# [1.16.0](https://github.com/fonoster/qcobro/compare/v1.15.0...v1.16.0) (2026-07-13)

### Features

- **portfolios:** show last-synced timestamp on the portfolio list ([#37](https://github.com/fonoster/qcobro/issues/37)) ([81f98e7](https://github.com/fonoster/qcobro/commit/81f98e76f8579be3d99f6adb02ce647d2f9a583a))

# [1.15.0](https://github.com/fonoster/qcobro/compare/v1.14.4...v1.15.0) (2026-07-13)

### Features

- **voice:** observe pre-recorded delivery in-process + gestión lifecycle ([#34](https://github.com/fonoster/qcobro/issues/34)) ([43a6496](https://github.com/fonoster/qcobro/commit/43a6496846064ed55e76027292c43920887596e9))

## [1.14.4](https://github.com/fonoster/qcobro/compare/v1.14.3...v1.14.4) (2026-07-12)

### Bug Fixes

- **webapp:** use input for Voz IA first message in reach-out modal ([#33](https://github.com/fonoster/qcobro/issues/33)) ([37e4aba](https://github.com/fonoster/qcobro/commit/37e4abaa8ae31522895301f87bab5aec0ad11695))

# [1.13.0](https://github.com/fonoster/qcobro/compare/v1.12.4...v1.13.0) (2026-07-12)

**Note:** Version bump only for package @qcobro/webapp

## [1.12.4](https://github.com/fonoster/qcobro/compare/v1.12.3...v1.12.4) (2026-07-10)

**Note:** Version bump only for package @qcobro/webapp

## [1.12.3](https://github.com/fonoster/qcobro/compare/v1.12.2...v1.12.3) (2026-07-01)

### Bug Fixes

- **webapp:** use modal for adding WhatsApp sender numbers ([cffa04a](https://github.com/fonoster/qcobro/commit/cffa04aef6b9c7379cf88ccc62bc3c6e2de6ba7d))

## [1.12.2](https://github.com/fonoster/qcobro/compare/v1.12.1...v1.12.2) (2026-07-01)

### Bug Fixes

- **gestiones:** match EMAIL gestión detail's dedicated (not generic) insight ([36672a7](https://github.com/fonoster/qcobro/commit/36672a761faba24002f17eaeaf19f3e819ed85ff))

# [1.12.0](https://github.com/fonoster/qcobro/compare/v1.11.4...v1.12.0) (2026-07-01)

### Features

- **webapp:** add account metadata expander to portfolio account detail dialog ([d6fa278](https://github.com/fonoster/qcobro/commit/d6fa278f7155a256995443c3069ae57d1825ba4d))

# [1.11.0](https://github.com/fonoster/qcobro/compare/v1.10.0...v1.11.0) (2026-06-30)

### Bug Fixes

- **webapp:** proactive silent token refresh — no more mid-session logouts ([6288a0b](https://github.com/fonoster/qcobro/commit/6288a0b6b0730710bbb70811febc457c757e67fd))

### Features

- **whatsapp:** web console — integrations page, agent modal, campaign sender, gestión thread ([7885031](https://github.com/fonoster/qcobro/commit/7885031a859d5dad9a4d6911181857e43f73f48e))

# [1.10.0](https://github.com/fonoster/qcobro/compare/v1.9.0...v1.10.0) (2026-06-30)

### Features

- **webapp:** agent edit modal, table actions right-aligned, docs realistic IDs ([38a5031](https://github.com/fonoster/qcobro/commit/38a5031011c17a968d7eb762367054b4d8d2d21e))

# [1.9.0](https://github.com/fonoster/qcobro/compare/v1.8.0...v1.9.0) (2026-06-29)

### Features

- **common:** add isDue outreach variable and document template variables ([ed7a511](https://github.com/fonoster/qcobro/commit/ed7a51161b758d2337055028f7adf52f22f7ae56))

# [1.8.0](https://github.com/fonoster/qcobro/compare/v1.7.0...v1.8.0) (2026-06-29)

### Features

- **webapp:** surface copyable workspace accessKeyId on cards and dashboard ([7cc52a8](https://github.com/fonoster/qcobro/commit/7cc52a863b0b9ac50350ef4908f534b6497c5a18))

# [1.6.0](https://github.com/fonoster/qcobro/compare/v1.5.6...v1.6.0) (2026-06-28)

### Features

- **webapp:** account menu on workspaces hub + account-level profile ([#10](https://github.com/fonoster/qcobro/issues/10)) ([14cb064](https://github.com/fonoster/qcobro/commit/14cb064cf2746cf20f782aefa67c387faf74085c)), closes [#9](https://github.com/fonoster/qcobro/issues/9)

## [1.5.6](https://github.com/fonoster/qcobro/compare/v1.5.5...v1.5.6) (2026-06-28)

### Bug Fixes

- **webapp:** show the per-channel insight for email too; enable gestiones-channels ([f2756b3](https://github.com/fonoster/qcobro/commit/f2756b378cf4f0ac6f5d754cf52e4649c9c2b633))

## [1.5.5](https://github.com/fonoster/qcobro/compare/v1.5.4...v1.5.5) (2026-06-28)

### Bug Fixes

- **webapp:** staleTime 0 so navigating refetches lists ([b559e1e](https://github.com/fonoster/qcobro/commit/b559e1ecc53879f1477c54ff03bc326f8c9718bb))

## [1.5.4](https://github.com/fonoster/qcobro/compare/v1.5.3...v1.5.4) (2026-06-28)

**Note:** Version bump only for package @qcobro/webapp

## [1.5.3](https://github.com/fonoster/qcobro/compare/v1.5.2...v1.5.3) (2026-06-28)

### Bug Fixes

- **webapp:** refresh workspaces.list after creating a workspace ([57f750a](https://github.com/fonoster/qcobro/commit/57f750afd10fcc3729c96f83546c9778e122d0a7))

# [1.5.0](https://github.com/fonoster/qcobro/compare/v1.4.1...v1.5.0) (2026-06-28)

### Features

- **profile-language:** per-user language preference + i18n hygiene sweep ([dbddb9c](https://github.com/fonoster/qcobro/commit/dbddb9c7915103afc339ec9d695b27c97d7634ce))

# [1.4.0](https://github.com/fonoster/qcobro/compare/v1.3.2...v1.4.0) (2026-06-28)

### Features

- **workspace-settings:** collect currency + timezone at workspace creation ([682ae8f](https://github.com/fonoster/qcobro/commit/682ae8f5fcf2045564c0dd5ac0e8f38fa736ed4a))

## [1.3.2](https://github.com/fonoster/qcobro/compare/v1.3.1...v1.3.2) (2026-06-28)

**Note:** Version bump only for package @qcobro/webapp

## [1.3.1](https://github.com/fonoster/qcobro/compare/v1.3.0...v1.3.1) (2026-06-28)

**Note:** Version bump only for package @qcobro/webapp

# [1.3.0](https://github.com/fonoster/qcobro/compare/v1.2.3...v1.3.0) (2026-06-28)

### Features

- **webapp:** live dashboard KPIs + contact rate; hide WhatsApp; drop dead-ends ([6bdd06d](https://github.com/fonoster/qcobro/commit/6bdd06d61aa0963507e232f1b612d322e866e5b6))
- **workspace-settings:** per-workspace currency + timezone (off Identity) ([c1516a3](https://github.com/fonoster/qcobro/commit/c1516a3d306e2b2a906d9ae476fb27f23887d5ae))

## [1.2.3](https://github.com/fonoster/qcobro/compare/v1.2.2...v1.2.3) (2026-06-28)

### Bug Fixes

- **webapp:** create-workspace region defaults to NYC01, close button cursor ([9196f48](https://github.com/fonoster/qcobro/commit/9196f487fb98d76670eef424ac2fa77344ec0e71))

# [1.2.0](https://github.com/fonoster/qcobro/compare/v1.1.4...v1.2.0) (2026-06-28)

### Features

- **payment-promises:** outcomes + PaymentPromise worklist, agent-based outreach ([6c620f8](https://github.com/fonoster/qcobro/commit/6c620f8a80c65a7178b0716b825a7d4ebb4077f7))

## [1.1.4](https://github.com/fonoster/qcobro/compare/v1.1.3...v1.1.4) (2026-06-28)

### Bug Fixes

- **webapp:** update PaymentPromises page content after rename ([89c5e44](https://github.com/fonoster/qcobro/commit/89c5e44edb318a3ccb0a299d913cc947de1bc1b5))

## [1.1.2](https://github.com/fonoster/qcobro/compare/v1.1.1...v1.1.2) (2026-06-28)

### Bug Fixes

- **webapp:** update App.tsx import after Objetivos → PaymentPromises rename ([78644ec](https://github.com/fonoster/qcobro/commit/78644ecd8f45364c0e8ebcaf3fe80cd3acd9f5c9))

## [1.1.1](https://github.com/fonoster/qcobro/compare/v1.1.0...v1.1.1) (2026-06-28)

### Bug Fixes

- **docker:** copy prisma.mjs into image and run migrations from apiserver dir ([d7898fe](https://github.com/fonoster/qcobro/commit/d7898fe74b3749fc3bbc79ae50c748a778005539))

# 1.1.0 (2026-06-28)

### Bug Fixes

- adapt to Prisma 7.8, fix adapter API, add initial migration ([4453022](https://github.com/fonoster/qcobro/commit/44530226095aa56037ac258dcaa26a7b98e370ea))
- add @vitejs/plugin-react and upgrade vite to v8 in webapp ([9fa8eff](https://github.com/fonoster/qcobro/commit/9fa8eff62b5eae6516ba55e773e00599e413dfd5))
- **console:** match dashboard recent-gestión icons to the agent channel ([45dd383](https://github.com/fonoster/qcobro/commit/45dd383b17d1334289cd2601084e0fd3cdeaed6e))
- **console:** show profile name in nav-bar user menu ([af24633](https://github.com/fonoster/qcobro/commit/af246335cd2db9aaf88e7bd7ea6869a06f4174c7))
- **e2e:** correct invite-acceptance test selectors and route ([682cfbd](https://github.com/fonoster/qcobro/commit/682cfbde8e8045f597bdd5e2ad13732e362c6f4a))
- **voice:** provision AUTOPILOT apps with required conversation settings ([c92a8aa](https://github.com/fonoster/qcobro/commit/c92a8aa52c30e2c8f3f78145dec17a99b72282cd))
- **webapp:** drop unused fromName/fromEmail from EMAIL agent form; add Resend status badge ([625c3c8](https://github.com/fonoster/qcobro/commit/625c3c8300d275f9f1982353bdf87112a9f03fa2))
- **webapp:** keep the sidebar fixed; only the content scrolls ([3413b87](https://github.com/fonoster/qcobro/commit/3413b87eb95b4b4c64901ab28b474dbcb773d1c0))
- **webapp:** remove Saldo nav item and member status dots ([afdc87e](https://github.com/fonoster/qcobro/commit/afdc87ef27441f77db43d60d4dc6bc02a987c8f6))
- **webapp:** resolve unknown ReactNode type error in GestionDetail email header ([2089419](https://github.com/fonoster/qcobro/commit/2089419be128afd0a025a9a0147bff47be62ef3c))
- **webapp:** surface email systemPrompt on detail page, fix dialog scroll and user menu z-index ([83b9945](https://github.com/fonoster/qcobro/commit/83b99451660cb1cdf0b14156bac63450366850f6))
- **workspaces:** wire invite acceptance to Identity HTTP bridge ([5b9fc40](https://github.com/fonoster/qcobro/commit/5b9fc40c57cd8d692d2711c1483bbd158e01aa54))

### Features

- **agent-templates:** per-channel agents, voices-from-config, Fonoster Voz IA sync ([6a8065d](https://github.com/fonoster/qcobro/commit/6a8065d27f8954aa5c5faf7ab34553dccefda5fc))
- **ai-insights:** transcript-based AI analysis + Voz IA wiring ([4ed7d2e](https://github.com/fonoster/qcobro/commit/4ed7d2e0faf2af9d8ff7966c687c346183b05184))
- **api-keys:** workspace API key management ([30dd25d](https://github.com/fonoster/qcobro/commit/30dd25d52e1083afb66c7bd323b10d0ac193425a))
- **api,webapp:** delete-workspace — ownerProcedure and WorkspaceSettings UI ([2542443](https://github.com/fonoster/qcobro/commit/2542443d6cdf4c9a6b2587e3380de9ea3e9f8263))
- **api,webapp:** profile-management — profile router and Profile page ([5850ec6](https://github.com/fonoster/qcobro/commit/5850ec6e777a987c559f6ab94a15725bc998820f))
- **api:** complete auth-and-workspaces change — password reset, resend invite, accept-invite UI ([09c557b](https://github.com/fonoster/qcobro/commit/09c557b00dfee7de725e45cfc5f6e5f61e91f44d))
- **campaigns:** campaigns-core — lifecycle, days-of-week, edit modal, specs synced ([d1e75cd](https://github.com/fonoster/qcobro/commit/d1e75cd9e065a1556811ee0abf94c4e2ab569e20))
- **campaigns:** checkpoint campaigns-core WIP before refinement ([2b3e339](https://github.com/fonoster/qcobro/commit/2b3e339913ab4de37152ed04e5aaf0d90fb247c4))
- **console:** config-driven announcement banner; flag unimplemented data ([01d8977](https://github.com/fonoster/qcobro/commit/01d89775fa547766521c5be5c15ba429bf5a655c))
- **console:** refinement + cleanup pass ([78dc3e5](https://github.com/fonoster/qcobro/commit/78dc3e58f2a4eaede4bf10a9d2a551b3c426d9ee))
- **console:** show real cartera and member counts in workspace picker ([ef4ab5c](https://github.com/fonoster/qcobro/commit/ef4ab5cae40ce81fad1292ed313c840e39fa7a6e))
- **console:** show relative "time ago" dates in Gestiones list ([4bafc99](https://github.com/fonoster/qcobro/commit/4bafc993c647673566150176225ad7bc0d99c4bd))
- **email-channel:** webapp — autopilot config + gestión email thread ([41e3041](https://github.com/fonoster/qcobro/commit/41e304128863339ff23bb965f5574e0f1dbac24e))
- **email:** bidirectional email channel end-to-end ([b49a442](https://github.com/fonoster/qcobro/commit/b49a442104841023f3507a6c33cf85dfe689bf12))
- **gestiones:** add voz IA channel webhook and rich detail panel ([824671f](https://github.com/fonoster/qcobro/commit/824671f0da22dcc9ec16a610618925f96e28d2c8))
- **gestiones:** channel-aware detail panel + refined list ([063d337](https://github.com/fonoster/qcobro/commit/063d3379eabd431b95035772ff523816f87a8398))
- **insight:** generate AI analysis for EMAIL gestiones from reply threads ([2d45dc3](https://github.com/fonoster/qcobro/commit/2d45dc3353d2923eaefba8ff4a80fbc4dd087053))
- **manual-outreach:** carteras reach-out modal + campaign-derived dispatch ([367db2d](https://github.com/fonoster/qcobro/commit/367db2d370c893317042b76239acb7d39c3e69f7))
- **portfolios:** portfolio management, status enums, currency, and row actions ([6b6bac9](https://github.com/fonoster/qcobro/commit/6b6bac914d85f5140da0abfaa84bd682686364e3))
- scaffold Qcobro app monorepo ([d5a7507](https://github.com/fonoster/qcobro/commit/d5a7507016d27cc2f76ece0c6aaeff33186d8da0))
- scaffold spec-driven monorepo foundation ([1a17d89](https://github.com/fonoster/qcobro/commit/1a17d89dffe686032caafe1c09be50053286e48b))
- **webapp:** add auth console UI (Group 6) ([718e04f](https://github.com/fonoster/qcobro/commit/718e04f483ab618c83daa74bfe8eefa9ed49a81e))
- **webapp:** add cartera and member count meta to workspace cards ([30be789](https://github.com/fonoster/qcobro/commit/30be789a0d90fa021bbbec34941eaee65eea9207))
- **webapp:** adopt Table V2 with selection, status pills, and i18n chrome ([d180cb2](https://github.com/fonoster/qcobro/commit/d180cb2ba88d149b9b637cfac683c29d5abc4e24))
- **webapp:** contact-verification screen ([a111a3b](https://github.com/fonoster/qcobro/commit/a111a3b86b0385fe203e4afcedad012bbda280bb))
- **webapp:** implement Pencil UI — login brand panel, workspace picker, sidebar redesign ([e34ef12](https://github.com/fonoster/qcobro/commit/e34ef123b68941a007304316f3c0135f50a69cbd))
- **webapp:** member-management actions UI ([4600361](https://github.com/fonoster/qcobro/commit/4600361a1410f23f1aeb0ef9a0d5a31412aa1798))
- **workspaces:** rename + console navigation (workspace-management) ([46acf86](https://github.com/fonoster/qcobro/commit/46acf86d32a09d3cf4474818f4950e35776bef01))
