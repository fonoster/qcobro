# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.19.0](https://github.com/fonoster/qcobro/compare/v1.18.0...v1.19.0) (2026-07-13)

### Features

- **common:** add list-users admin CLI ([#43](https://github.com/fonoster/qcobro/issues/43)) ([56ddd07](https://github.com/fonoster/qcobro/commit/56ddd0768abe8201d2070febfb087c8fd0bb1b1c)), closes [#42](https://github.com/fonoster/qcobro/issues/42)

# [1.18.0](https://github.com/fonoster/qcobro/compare/v1.17.0...v1.18.0) (2026-07-13)

### Features

- **mcp:** add MCP server package for the QCobro API ([#38](https://github.com/fonoster/qcobro/issues/38)) ([baeeb10](https://github.com/fonoster/qcobro/commit/baeeb1029df4d02b49f5b4204500d0be8306391a)), closes [fonoster/qcobro#16](https://github.com/fonoster/qcobro/issues/16)

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

## [1.14.3](https://github.com/fonoster/qcobro/compare/v1.14.2...v1.14.3) (2026-07-12)

### Bug Fixes

- **apiserver:** bump @fonoster/sdk to 0.22.2 ([#32](https://github.com/fonoster/qcobro/issues/32)) ([f037257](https://github.com/fonoster/qcobro/commit/f0372574a737fb5949756ac9eb0bfe2692e673b1)), closes [fonoster/fonoster#864](https://github.com/fonoster/fonoster/issues/864) [#27](https://github.com/fonoster/qcobro/issues/27)
- **compose:** expose apiserver voice port 50061 ([#31](https://github.com/fonoster/qcobro/issues/31)) ([ef40dee](https://github.com/fonoster/qcobro/commit/ef40dee163172ab6cb559f7dceb92b05e63a81f9))

## [1.14.2](https://github.com/fonoster/qcobro/compare/v1.14.1...v1.14.2) (2026-07-12)

### Bug Fixes

- **billing:** sanitize provider errors before they reach the client, log the rest ([ddfff1a](https://github.com/fonoster/qcobro/commit/ddfff1ad534c36471e447508e3a6787600918592))
- **ci:** stop Release workflow from publishing orphaned tags ([1e92348](https://github.com/fonoster/qcobro/commit/1e92348967e0a3263ed4f83cb36e5d4383477397))

## [1.13.1](https://github.com/fonoster/qcobro/compare/v1.13.0...v1.13.1) (2026-07-12)

**Note:** Version bump only for package qcobro

# [1.13.0](https://github.com/fonoster/qcobro/compare/v1.12.4...v1.13.0) (2026-07-12)

### Features

- **api:** record engine flight-recorder events with retention pruning ([6e85346](https://github.com/fonoster/qcobro/commit/6e85346e650624d0558379f0f0bf72d2680c8ebf))
- **api:** sim clock/tick knobs, runner-driven recording, and apikey:create ([e0bf437](https://github.com/fonoster/qcobro/commit/e0bf43784d73312ca6d262ea54b1b94bc0aa359d))
- **api:** workspace-scoped engine-events endpoint and provider-event capture ([c5f6f61](https://github.com/fonoster/qcobro/commit/c5f6f61d6b73847a7a43b79ca1cc9c9cc721725a))
- **common:** engine flight-recorder contracts and deterministic scorecard judge ([72c3f88](https://github.com/fonoster/qcobro/commit/72c3f882425a5fcc66d32acc8aec0d1a23f8a201))
- **common:** engine-eval npx CLI for judging a deployment ([193f959](https://github.com/fonoster/qcobro/commit/193f959e520f9a3f13ca9d26effc0fb99cefbd8c))
- **deploy:** route gRPC to the pre-recorded VoiceServer ([#22](https://github.com/fonoster/qcobro/issues/22)) ([e78f9e1](https://github.com/fonoster/qcobro/commit/e78f9e1eac5c909533e3a4597a9fbe4f1e353462))

## [1.12.4](https://github.com/fonoster/qcobro/compare/v1.12.3...v1.12.4) (2026-07-10)

### Bug Fixes

- **api:** stop email-inbound webhook crashes (invalid promise dates + malformed cloak key) ([#21](https://github.com/fonoster/qcobro/issues/21)) ([a51a5b5](https://github.com/fonoster/qcobro/commit/a51a5b561fb130aebbf9bbd3591a390f502ac5fe))

## [1.12.3](https://github.com/fonoster/qcobro/compare/v1.12.2...v1.12.3) (2026-07-01)

### Bug Fixes

- **e2e:** stop payment-promises.spec.ts clicking the workspace switcher open ([bf8e423](https://github.com/fonoster/qcobro/commit/bf8e423d45a803cb093c0788c8e134ae1d79523d))
- **webapp:** use modal for adding WhatsApp sender numbers ([cffa04a](https://github.com/fonoster/qcobro/commit/cffa04aef6b9c7379cf88ccc62bc3c6e2de6ba7d))

## [1.12.2](https://github.com/fonoster/qcobro/compare/v1.12.1...v1.12.2) (2026-07-01)

### Bug Fixes

- **gestiones:** match EMAIL gestión detail's dedicated (not generic) insight ([36672a7](https://github.com/fonoster/qcobro/commit/36672a761faba24002f17eaeaf19f3e819ed85ff))

## [1.12.1](https://github.com/fonoster/qcobro/compare/v1.12.0...v1.12.1) (2026-07-01)

### Bug Fixes

- **whatsapp:** dispatch to the sender's Meta phone_number_id, not its internal id ([0956217](https://github.com/fonoster/qcobro/commit/0956217347eeeb83d18efe9080246ad98c75cdcf))

# [1.12.0](https://github.com/fonoster/qcobro/compare/v1.11.4...v1.12.0) (2026-07-01)

### Bug Fixes

- **deploy:** add --force-renewal to certbot SAN expansion ([a0c8b2a](https://github.com/fonoster/qcobro/commit/a0c8b2a0f95256c41a992ab27494595e61347b2e))

### Features

- **common:** add comparison and date Handlebars helpers for outreach templates ([fbb9ab8](https://github.com/fonoster/qcobro/commit/fbb9ab8dfbb408ce2d6b9fa176299d3b92600e0e))
- **common:** add multiply Handlebars helper, make renderTemplate error-safe ([4184035](https://github.com/fonoster/qcobro/commit/4184035593fbb968d6a5174d60056f54b7650d3f))
- **webapp:** add account metadata expander to portfolio account detail dialog ([d6fa278](https://github.com/fonoster/qcobro/commit/d6fa278f7155a256995443c3069ae57d1825ba4d))

# [1.11.0](https://github.com/fonoster/qcobro/compare/v1.10.0...v1.11.0) (2026-06-30)

### Bug Fixes

- **webapp:** proactive silent token refresh — no more mid-session logouts ([6288a0b](https://github.com/fonoster/qcobro/commit/6288a0b6b0730710bbb70811febc457c757e67fd))

### Features

- **ci:** publish @qcobro/sdk to npm on version tags ([0a6435b](https://github.com/fonoster/qcobro/commit/0a6435b06ed91b19094abe435f0654f9885d4175))
- **deploy:** add api.qcobro.com SAN to TLS cert (TLS_API_DOMAIN) ([b6636bd](https://github.com/fonoster/qcobro/commit/b6636bd46988df639479dc2f7f402c8d302b6ef9))
- **whatsapp:** inbound autopilot — reply, opt-out, payment promise (§7.3, §7.4, §9.4) ([ef37a91](https://github.com/fonoster/qcobro/commit/ef37a9109909cb9e86ff3a787b5af06ed199fd78))
- **whatsapp:** inbound event processing — opt-out suppression + quality-rating (§7.2, §9.3) ([974a9e3](https://github.com/fonoster/qcobro/commit/974a9e35d549e1baf6386ac6bcec40297c8ae703))
- **whatsapp:** web console — integrations page, agent modal, campaign sender, gestión thread ([7885031](https://github.com/fonoster/qcobro/commit/7885031a859d5dad9a4d6911181857e43f73f48e))
- **whatsapp:** wire engine tick, webhook handshake, and unit tests (§6.2, §7.1, §9.1–9.2) ([a46bb1f](https://github.com/fonoster/qcobro/commit/a46bb1fd0f786e5856281da48d07f2f3249081e7))

# [1.10.0](https://github.com/fonoster/qcobro/compare/v1.9.0...v1.10.0) (2026-06-30)

### Features

- **site:** add brand kit page with mobile nav hamburger menu ([ff4d0c6](https://github.com/fonoster/qcobro/commit/ff4d0c6a8e25e096e1049e37e39eb84ef45f3c21))
- **webapp:** agent edit modal, table actions right-aligned, docs realistic IDs ([38a5031](https://github.com/fonoster/qcobro/commit/38a5031011c17a968d7eb762367054b4d8d2d21e))
- **whatsapp:** add WhatsApp channel server foundation (§2–§6.1) ([51211f3](https://github.com/fonoster/qcobro/commit/51211f3b8af1cd7fb45e0b2ded40262915606548)), closes [#5](https://github.com/fonoster/qcobro/issues/5)

# [1.9.0](https://github.com/fonoster/qcobro/compare/v1.8.0...v1.9.0) (2026-06-29)

### Bug Fixes

- **api:** stop resending Voz IA system prompt as call metadata ([0d66d18](https://github.com/fonoster/qcobro/commit/0d66d18b34d0f353f02d96599d8784f0f372a547))

### Features

- **common:** add isDue outreach variable and document template variables ([ed7a511](https://github.com/fonoster/qcobro/commit/ed7a51161b758d2337055028f7adf52f22f7ae56))

# [1.8.0](https://github.com/fonoster/qcobro/compare/v1.7.0...v1.8.0) (2026-06-29)

### Features

- **docs:** add website and dashboard links to docs navbar ([a80c6c4](https://github.com/fonoster/qcobro/commit/a80c6c45acb4be11000febfe4c603f88c0c1cb9b))
- **webapp:** surface copyable workspace accessKeyId on cards and dashboard ([7cc52a8](https://github.com/fonoster/qcobro/commit/7cc52a863b0b9ac50350ef4908f534b6497c5a18))

# [1.7.0](https://github.com/fonoster/qcobro/compare/v1.6.0...v1.7.0) (2026-06-28)

### Features

- **sdk:** default endpoint to https://api.qcobro.com ([c31c422](https://github.com/fonoster/qcobro/commit/c31c422e630eaac91dafe17a6f3527d58ff271d0))

# [1.6.0](https://github.com/fonoster/qcobro/compare/v1.5.6...v1.6.0) (2026-06-28)

### Features

- **site:** launch marketing website v2 ([#8](https://github.com/fonoster/qcobro/issues/8)) ([2ef9753](https://github.com/fonoster/qcobro/commit/2ef975347d030b7f2cfe1b7683474732cd252590))
- **webapp:** account menu on workspaces hub + account-level profile ([#10](https://github.com/fonoster/qcobro/issues/10)) ([14cb064](https://github.com/fonoster/qcobro/commit/14cb064cf2746cf20f782aefa67c387faf74085c)), closes [#9](https://github.com/fonoster/qcobro/issues/9)

## [1.5.6](https://github.com/fonoster/qcobro/compare/v1.5.5...v1.5.6) (2026-06-28)

### Bug Fixes

- **e2e:** disable contactLogAuth in CI config; drop unreliable image cache ([8982ca6](https://github.com/fonoster/qcobro/commit/8982ca62099d1293333f5e46ed0c3762a793b6f4))
- **webapp:** show the per-channel insight for email too; enable gestiones-channels ([f2756b3](https://github.com/fonoster/qcobro/commit/f2756b378cf4f0ac6f5d754cf52e4649c9c2b633))

## [1.5.5](https://github.com/fonoster/qcobro/compare/v1.5.4...v1.5.5) (2026-06-28)

### Bug Fixes

- **e2e:** reload after out-of-band seeding; enable ai-insights + payment-promises ([dea9312](https://github.com/fonoster/qcobro/commit/dea931268316530a5fcff6e7094e1d0a8852d570))
- **webapp:** staleTime 0 so navigating refetches lists ([b559e1e](https://github.com/fonoster/qcobro/commit/b559e1ecc53879f1477c54ff03bc326f8c9718bb))

## [1.5.4](https://github.com/fonoster/qcobro/compare/v1.5.3...v1.5.4) (2026-06-28)

### Bug Fixes

- **e2e:** supply fonoster voices in CI config; enable campaigns + console specs ([2ff90ab](https://github.com/fonoster/qcobro/commit/2ff90aba4da71f7e6d902aacff753ea5a9411950))

## [1.5.3](https://github.com/fonoster/qcobro/compare/v1.5.2...v1.5.3) (2026-06-28)

### Bug Fixes

- **release:** remove duplicate v prefix and update identity smtp to Resend ([e3b08ac](https://github.com/fonoster/qcobro/commit/e3b08aca8b98b7d779354040524be794f89d272a))
- **webapp:** refresh workspaces.list after creating a workspace ([57f750a](https://github.com/fonoster/qcobro/commit/57f750afd10fcc3729c96f83546c9778e122d0a7))

## [1.5.2](https://github.com/fonoster/qcobro/compare/v1.5.1...v1.5.2) (2026-06-28)

### Bug Fixes

- **apiserver:** prisma.mjs reads config from config/qcobro.json ([3299872](https://github.com/fonoster/qcobro/commit/32998725c72dbbefcbfdf366d17770ea7f033f43))
- **apiserver:** prisma.mjs reads config from config/qcobro.json ([60fb33d](https://github.com/fonoster/qcobro/commit/60fb33def6cf0d158f462958c7444a310232a729))

# [1.5.0](https://github.com/fonoster/qcobro/compare/v1.4.1...v1.5.0) (2026-06-28)

### Features

- **profile-language:** per-user language preference + i18n hygiene sweep ([dbddb9c](https://github.com/fonoster/qcobro/commit/dbddb9c7915103afc339ec9d695b27c97d7634ce))

# [1.4.0](https://github.com/fonoster/qcobro/compare/v1.3.2...v1.4.0) (2026-06-28)

### Features

- **workspace-settings:** collect currency + timezone at workspace creation ([682ae8f](https://github.com/fonoster/qcobro/commit/682ae8f5fcf2045564c0dd5ac0e8f38fa736ed4a))

## [1.3.2](https://github.com/fonoster/qcobro/compare/v1.3.1...v1.3.2) (2026-06-28)

**Note:** Version bump only for package qcobro

## [1.3.1](https://github.com/fonoster/qcobro/compare/v1.3.0...v1.3.1) (2026-06-28)

### Bug Fixes

- **timezone:** contact-log REST uses workspace tz; default is a constant ([1b86419](https://github.com/fonoster/qcobro/commit/1b86419fc98722d0c1174ce9f1bdf19848b35dd5))

# [1.3.0](https://github.com/fonoster/qcobro/compare/v1.2.3...v1.3.0) (2026-06-28)

### Features

- **webapp:** live dashboard KPIs + contact rate; hide WhatsApp; drop dead-ends ([6bdd06d](https://github.com/fonoster/qcobro/commit/6bdd06d61aa0963507e232f1b612d322e866e5b6))
- **workspace-settings:** per-workspace currency + timezone (off Identity) ([c1516a3](https://github.com/fonoster/qcobro/commit/c1516a3d306e2b2a906d9ae476fb27f23887d5ae))

## [1.2.3](https://github.com/fonoster/qcobro/compare/v1.2.2...v1.2.3) (2026-06-28)

### Bug Fixes

- **webapp:** create-workspace region defaults to NYC01, close button cursor ([9196f48](https://github.com/fonoster/qcobro/commit/9196f487fb98d76670eef424ac2fa77344ec0e71))

## [1.2.1](https://github.com/fonoster/qcobro/compare/v1.2.0...v1.2.1) (2026-06-28)

### Bug Fixes

- **deploy:** fix identity key permissions at container startup ([9715bd1](https://github.com/fonoster/qcobro/commit/9715bd13ca1d355562a84c0a2e408413571bf12f))

# [1.2.0](https://github.com/fonoster/qcobro/compare/v1.1.4...v1.2.0) (2026-06-28)

### Features

- **payment-promises:** outcomes + PaymentPromise worklist, agent-based outreach ([6c620f8](https://github.com/fonoster/qcobro/commit/6c620f8a80c65a7178b0716b825a7d4ebb4077f7))

## [1.1.4](https://github.com/fonoster/qcobro/compare/v1.1.3...v1.1.4) (2026-06-28)

### Bug Fixes

- **webapp:** update PaymentPromises page content after rename ([89c5e44](https://github.com/fonoster/qcobro/commit/89c5e44edb318a3ccb0a299d913cc947de1bc1b5))

## [1.1.3](https://github.com/fonoster/qcobro/compare/v1.1.2...v1.1.3) (2026-06-28)

### Bug Fixes

- **docker:** add common/package.json to image and fix JSON import for Node 22 ([da4a0aa](https://github.com/fonoster/qcobro/commit/da4a0aa5301eccfcd36cffa7b6dada1b13951446))

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
- **apiserver:** send reply_to as array to satisfy Resend API validation ([14691e8](https://github.com/fonoster/qcobro/commit/14691e8b8c2896089b15fd4cdb0df9575e483667))
- build common and agents before starting dev server ([658d1e9](https://github.com/fonoster/qcobro/commit/658d1e990066592486dcdcf61f21e9707bd0f357))
- **build:** tolerate missing qcobro.json; fix Docker image build ([994d0a2](https://github.com/fonoster/qcobro/commit/994d0a205334cce93373027127930023e2305460))
- **campaigns-engine:** log the reason a dispatch fails ([f00d800](https://github.com/fonoster/qcobro/commit/f00d80098dfc13c92db67a736373de87d3bb393f))
- **channel-dispatch:** allow empty firstMessage for VOICE_AI; non-destructive engine test ([71e17a6](https://github.com/fonoster/qcobro/commit/71e17a6a32d8353e9d428e5763e937408df066df))
- **channel-dispatch:** pre-recorded voice has no firstMessage either ([ebc8e90](https://github.com/fonoster/qcobro/commit/ebc8e9049b765388e8e0e7505dccef22d4dde875))
- **ci:** build before typecheck so cross-project refs resolve ([e010956](https://github.com/fonoster/qcobro/commit/e010956f49bc451cba6e79e7c7a3ee38bb113e7f))
- **ci:** exclude .github, openspec, site from Docker build context ([42bd50a](https://github.com/fonoster/qcobro/commit/42bd50aed7bf0ece5dd0080627f3c832c670314b))
- **ci:** generate Prisma client before build ([fda7dd5](https://github.com/fonoster/qcobro/commit/fda7dd52571f00375368bb2f5f63184e20cf2c6d))
- **ci:** provide CI qcobro.json and fix docker tag output ([b7403f6](https://github.com/fonoster/qcobro/commit/b7403f69cd9340ff9d831227560b6ead73a264b1))
- **ci:** simplify CI; rebuild e2e around compose.dev.yaml ([a4f2cd2](https://github.com/fonoster/qcobro/commit/a4f2cd2af8384328711b780d7eab099e6df35585))
- **compose:** re-add SMS-fix volume mount lost in db consolidation ([5d7f56b](https://github.com/fonoster/qcobro/commit/5d7f56bc190bc85695bb14d39b559d33ce0d9fca))
- **compose:** restore SMS-fix volume mount dropped from previous commit ([c48929e](https://github.com/fonoster/qcobro/commit/c48929e08174f3cea1b9d50ca499ff2d88e98686))
- **console:** match dashboard recent-gestión icons to the agent channel ([45dd383](https://github.com/fonoster/qcobro/commit/45dd383b17d1334289cd2601084e0fd3cdeaed6e))
- **console:** show profile name in nav-bar user menu ([af24633](https://github.com/fonoster/qcobro/commit/af246335cd2db9aaf88e7bd7ea6869a06f4174c7))
- **deps:** dedupe @grpc/grpc-js to a single copy ([095bf48](https://github.com/fonoster/qcobro/commit/095bf481f1d91fa3ece333539ee84df45bf9c44d))
- **deps:** reconcile lockfile for grpc-js dedupe (npm ci consistent) ([86107d3](https://github.com/fonoster/qcobro/commit/86107d3cdd9bad6f3987e3b296e661d59d343754))
- **dev:** auto-create the identity database; stop seed masking real errors ([562ff31](https://github.com/fonoster/qcobro/commit/562ff311a5a9292cb7cf92a3ab320ffd4cb90901))
- **e2e:** correct invite-acceptance test selectors and route ([682cfbd](https://github.com/fonoster/qcobro/commit/682cfbde8e8045f597bdd5e2ad13732e362c6f4a))
- **email:** hydrate inbound body from received-emails api; strip quoted history ([ddcbdb1](https://github.com/fonoster/qcobro/commit/ddcbdb170953cb9428d92a0cc385d5b83eb43cfd))
- **voice:** provision AUTOPILOT apps with required conversation settings ([c92a8aa](https://github.com/fonoster/qcobro/commit/c92a8aa52c30e2c8f3f78145dec17a99b72282cd))
- **webapp:** drop unused fromName/fromEmail from EMAIL agent form; add Resend status badge ([625c3c8](https://github.com/fonoster/qcobro/commit/625c3c8300d275f9f1982353bdf87112a9f03fa2))
- **webapp:** keep the sidebar fixed; only the content scrolls ([3413b87](https://github.com/fonoster/qcobro/commit/3413b87eb95b4b4c64901ab28b474dbcb773d1c0))
- **webapp:** remove Saldo nav item and member status dots ([afdc87e](https://github.com/fonoster/qcobro/commit/afdc87ef27441f77db43d60d4dc6bc02a987c8f6))
- **webapp:** resolve unknown ReactNode type error in GestionDetail email header ([2089419](https://github.com/fonoster/qcobro/commit/2089419be128afd0a025a9a0147bff47be62ef3c))
- **webapp:** surface email systemPrompt on detail page, fix dialog scroll and user menu z-index ([83b9945](https://github.com/fonoster/qcobro/commit/83b99451660cb1cdf0b14156bac63450366850f6))
- **workspaces:** wire invite acceptance to Identity HTTP bridge ([5b9fc40](https://github.com/fonoster/qcobro/commit/5b9fc40c57cd8d692d2711c1483bbd158e01aa54))

### Features

- add functional demo ([7880f74](https://github.com/fonoster/qcobro/commit/7880f74862ddb6bd49c13cb2a07b8ec8c51d0280))
- add OpenGraph banner to site ([399e626](https://github.com/fonoster/qcobro/commit/399e626e2cd87e17bb5cd483ff6a71c1c70c1d47))
- add pricing section to marketing site ([db27adf](https://github.com/fonoster/qcobro/commit/db27adf2295abfa988c11394deab403d51b5f134))
- add the favicon to the site ([39a821b](https://github.com/fonoster/qcobro/commit/39a821bfc225470426d2198a31918c33f6863733))
- **agent-templates:** per-channel agents, voices-from-config, Fonoster Voz IA sync ([6a8065d](https://github.com/fonoster/qcobro/commit/6a8065d27f8954aa5c5faf7ab34553dccefda5fc))
- **ai-insights:** transcript-based AI analysis + Voz IA wiring ([4ed7d2e](https://github.com/fonoster/qcobro/commit/4ed7d2e0faf2af9d8ff7966c687c346183b05184))
- **api-keys:** workspace API key management ([30dd25d](https://github.com/fonoster/qcobro/commit/30dd25d52e1083afb66c7bd323b10d0ac193425a))
- **api,webapp:** delete-workspace — ownerProcedure and WorkspaceSettings UI ([2542443](https://github.com/fonoster/qcobro/commit/2542443d6cdf4c9a6b2587e3380de9ea3e9f8263))
- **api,webapp:** profile-management — profile router and Profile page ([5850ec6](https://github.com/fonoster/qcobro/commit/5850ec6e777a987c559f6ab94a15725bc998820f))
- **api:** add contact-verification and OAuth auth procedures ([b6b70c3](https://github.com/fonoster/qcobro/commit/b6b70c35dd8063ccbdc6e429ded21aa96154928d))
- **api:** complete auth-and-workspaces change — password reset, resend invite, accept-invite UI ([09c557b](https://github.com/fonoster/qcobro/commit/09c557b00dfee7de725e45cfc5f6e5f61e91f44d))
- **apiserver:** add auth router (signup, login, refresh, logout) ([9fd50e0](https://github.com/fonoster/qcobro/commit/9fd50e0a32c92ca6bcdf0c053f7050f16921b42b))
- **apiserver:** add email:smoke script for Resend outbound + inbound smoke test ([528ed56](https://github.com/fonoster/qcobro/commit/528ed56079ddec540c99e7be17d5d1d4b7a9e7d6))
- **apiserver:** add Identity gRPC client and wire it into context (Group 2) ([4ea93a3](https://github.com/fonoster/qcobro/commit/4ea93a3839e567ac23525922a71406473c4fb29d))
- **apiserver:** add workspace create/list/get (Group 5 core) ([99de39c](https://github.com/fonoster/qcobro/commit/99de39c29c692fd2760053c3bb7f196e11c1a05b))
- **apiserver:** verify access tokens and add authz procedures (Group 4) ([2353b9c](https://github.com/fonoster/qcobro/commit/2353b9cbf5a0fcd018655fe7f4861acbe87a4b73))
- **campaigns-engine:** channel emulators for simulation (group 4) ([1b98466](https://github.com/fonoster/qcobro/commit/1b98466d457e030cab2ce94e17c9aea3cd86df8d))
- **campaigns-engine:** engine orchestration + at-most-once proof (groups 5/6/8) ([de7d519](https://github.com/fonoster/qcobro/commit/de7d51947855ce131e87a8ad6dffed20567118fe))
- **campaigns-engine:** propose change + config/contracts (group 1) ([6ffd70d](https://github.com/fonoster/qcobro/commit/6ffd70df34cf0a3f33060243eadb1b7460e440eb))
- **campaigns-engine:** provider-ref correlation + objective uniqueness (group 2) ([b3da45b](https://github.com/fonoster/qcobro/commit/b3da45bc97fd4a2b6a534edb2cef6d8081bea52b))
- **campaigns-engine:** split createContactLog into reserve + record (group 3) ([6f812c9](https://github.com/fonoster/qcobro/commit/6f812c9c0ad3e66e3818fbd8e23ae45a1e1255f7))
- **campaigns-engine:** window gate, eligibility funnel, pacing buckets (group 5, pure) ([374093c](https://github.com/fonoster/qcobro/commit/374093c8cf5a28604d28e7b37b5866b4d11dde8c))
- **campaigns-engine:** wiring + cleanup (groups 7/9) ([828056d](https://github.com/fonoster/qcobro/commit/828056d091f419bafc5d675a6f0bd92e67bf9eb9))
- **campaigns:** campaigns-core — lifecycle, days-of-week, edit modal, specs synced ([d1e75cd](https://github.com/fonoster/qcobro/commit/d1e75cd9e065a1556811ee0abf94c4e2ab569e20))
- **campaigns:** checkpoint campaigns-core WIP before refinement ([2b3e339](https://github.com/fonoster/qcobro/commit/2b3e339913ab4de37152ed04e5aaf0d90fb247c4))
- **channel-dispatch:** outreach trigger layer (Fonoster voice + Twilio SMS) ([56a4b9e](https://github.com/fonoster/qcobro/commit/56a4b9e4c7c9267f0bfbad42b4b37fff74b6b8fb))
- **common:** add validated-function utilities and conventions guide ([a60bab9](https://github.com/fonoster/qcobro/commit/a60bab99affd9290602512e5921632c4a1f9f70f))
- **console:** config-driven announcement banner; flag unimplemented data ([01d8977](https://github.com/fonoster/qcobro/commit/01d89775fa547766521c5be5c15ba429bf5a655c))
- **console:** refinement + cleanup pass ([78dc3e5](https://github.com/fonoster/qcobro/commit/78dc3e58f2a4eaede4bf10a9d2a551b3c426d9ee))
- **console:** show real cartera and member counts in workspace picker ([ef4ab5c](https://github.com/fonoster/qcobro/commit/ef4ab5cae40ce81fad1292ed313c840e39fa7a6e))
- **console:** show relative "time ago" dates in Gestiones list ([4bafc99](https://github.com/fonoster/qcobro/commit/4bafc993c647673566150176225ad7bc0d99c4bd))
- **email-channel:** inbound autopilot — webhook, decision loop, reply cap ([67b6a85](https://github.com/fonoster/qcobro/commit/67b6a8515e75f8ca178293755bffa540a2a3d139))
- **email-channel:** outbound email + engine integration (Resend) ([391d3d0](https://github.com/fonoster/qcobro/commit/391d3d0caf3440d4f41568d0c48ec37c7ec76d36))
- **email-channel:** spec + contracts for bidirectional email (Resend autopilot) ([6c2461c](https://github.com/fonoster/qcobro/commit/6c2461ced535cc1b1eb4a7f9eb2a3dcd989dbbe5))
- **email-channel:** webapp — autopilot config + gestión email thread ([41e3041](https://github.com/fonoster/qcobro/commit/41e304128863339ff23bb965f5574e0f1dbac24e))
- **email:** bidirectional email channel end-to-end ([b49a442](https://github.com/fonoster/qcobro/commit/b49a442104841023f3507a6c33cf85dfe689bf12))
- **gestiones:** add voz IA channel webhook and rich detail panel ([824671f](https://github.com/fonoster/qcobro/commit/824671f0da22dcc9ec16a610618925f96e28d2c8))
- **gestiones:** channel-aware detail panel + refined list ([063d337](https://github.com/fonoster/qcobro/commit/063d3379eabd431b95035772ff523816f87a8398))
- identity now from the published fonoster identity mod ([9a6eaea](https://github.com/fonoster/qcobro/commit/9a6eaeaed20f51ea7a4846fe116735aeecdcc6e5))
- **identity:** add slim Fonoster Identity gRPC service (Group 1) ([7760164](https://github.com/fonoster/qcobro/commit/7760164ac4417d1ed6785e6da082899b6846e096))
- **infra:** add Dockerfile, Envoy TLS config, and DigitalOcean deploy guide ([c37d9ce](https://github.com/fonoster/qcobro/commit/c37d9ce00bdf38ebbba82f98f9209497eefcd206))
- **insight:** generate AI analysis for EMAIL gestiones from reply threads ([2d45dc3](https://github.com/fonoster/qcobro/commit/2d45dc3353d2923eaefba8ff4a80fbc4dd087053))
- **manual-outreach:** carteras reach-out modal + campaign-derived dispatch ([367db2d](https://github.com/fonoster/qcobro/commit/367db2d370c893317042b76239acb7d39c3e69f7))
- **portfolios:** portfolio management, status enums, currency, and row actions ([6b6bac9](https://github.com/fonoster/qcobro/commit/6b6bac914d85f5140da0abfaa84bd682686364e3))
- scaffold Qcobro app monorepo ([d5a7507](https://github.com/fonoster/qcobro/commit/d5a7507016d27cc2f76ece0c6aaeff33186d8da0))
- scaffold spec-driven monorepo foundation ([1a17d89](https://github.com/fonoster/qcobro/commit/1a17d89dffe686032caafe1c09be50053286e48b))
- **sdk:** add @qcobro/sdk with portfolios, API-key auth, and auto-refresh ([324405e](https://github.com/fonoster/qcobro/commit/324405e9922bf70ccd57088122098c6c2d8de2e7))
- **seed:** engine showcase covering every decision; sim shows names ([3e7056c](https://github.com/fonoster/qcobro/commit/3e7056ce04313458b948814398bbc227c0bf1b62))
- **voice:** embedded Fonoster VoiceServer for pre-recorded (external) agents ([00e581e](https://github.com/fonoster/qcobro/commit/00e581e78c503509ad7af4cade0b29b226a78a60))
- **voice:** make pre-recorded audio permanent and spec the events-hook ([8b03fdb](https://github.com/fonoster/qcobro/commit/8b03fdbbbd84cc4233578ae94e37a9a364171584))
- **voice:** pre-recorded via shared external app ref + Say playback ([e156292](https://github.com/fonoster/qcobro/commit/e15629223914a1141025a1804aa184222c3f244e))
- **webapp:** add auth console UI (Group 6) ([718e04f](https://github.com/fonoster/qcobro/commit/718e04f483ab618c83daa74bfe8eefa9ed49a81e))
- **webapp:** add cartera and member count meta to workspace cards ([30be789](https://github.com/fonoster/qcobro/commit/30be789a0d90fa021bbbec34941eaee65eea9207))
- **webapp:** adopt Table V2 with selection, status pills, and i18n chrome ([d180cb2](https://github.com/fonoster/qcobro/commit/d180cb2ba88d149b9b637cfac683c29d5abc4e24))
- **webapp:** contact-verification screen ([a111a3b](https://github.com/fonoster/qcobro/commit/a111a3b86b0385fe203e4afcedad012bbda280bb))
- **webapp:** implement Pencil UI — login brand panel, workspace picker, sidebar redesign ([e34ef12](https://github.com/fonoster/qcobro/commit/e34ef123b68941a007304316f3c0135f50a69cbd))
- **webapp:** member-management actions UI ([4600361](https://github.com/fonoster/qcobro/commit/4600361a1410f23f1aeb0ef9a0d5a31412aa1798))
- **workspaces:** rename + console navigation (workspace-management) ([46acf86](https://github.com/fonoster/qcobro/commit/46acf86d32a09d3cf4474818f4950e35776bef01))
