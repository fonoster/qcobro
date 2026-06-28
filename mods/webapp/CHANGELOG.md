# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
