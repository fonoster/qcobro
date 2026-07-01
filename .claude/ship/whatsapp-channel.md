# Ship checkpoint — whatsapp-channel

Started: 2026-06-30
Current stage: 4 — Test (done); 5 — Sync not yet run (see note below)

**Scope:** Add WhatsApp as an outreach channel via the Meta Cloud API directly (named template
parameters), built on a new per-workspace **Workspace Integrations** area that stores tenant-owned
WABA credentials (QCobro's first encrypted tenant secret, via the Fonoster/Routr `prisma-field-encryption`
"cloak" pattern). A campaign picks an explicit WhatsApp sender number; `dispatchOutreach` gains a
WHATSAPP branch with the messaging client resolved per-call from workspace creds; an inbound Meta
webhook feeds opt-outs into the existing `IntentStatus.OPT_OUT` suppression. WhatsApp Voice is captured
as a non-goal/future (Fonoster to own the transport — issue #12).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen at root) · Storybook: yes (mods/webapp/.storybook) · E2E: yes (playwright.config.ts + e2e/)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Surfaces detected; artifacts read; scope stated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1   | Design (Pencil) | done        | Gate approved. 5 frames: A) `k2CJIS` smart agent modal. B) workspace language on `q9QUoo`. C) `NeB6V` Integraciones page (in avatar menu `lKDuM`). D) `c7nkt` campaign sender selector. E) `s0cuz` WhatsApp gestión thread. + Voz IA promesa simplified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Spec reconcile  | done        | Folded in smart-agent (`systemPrompt`+`maxAgentReplies`, AI replies/24h window), workspace language source, template-id+read-only preview, avatar-menu. `openspec validate` passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | Build           | done        | §2–§8 all complete and committed to `main` (§2 contracts, §3 data model+cloak, §4 integration fns+tRPC, §5 Meta client+dispatch, §6 campaign sender selection+engine wiring, §7 inbound webhook/AI replies/opt-out, §8 web console). Confirmed by re-reading `tasks.md` + `git log` this session — the row above was stale.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Test            | done        | §9.1–9.4 pre-existing (unit tests). §9.5 (engine-tick e2e via emulator) added this session: `mods/apiserver/src/engine/whatsapp.integration.test.ts`, real dev Postgres, 170/170 apiserver tests green ×3 runs. Found + fixed a real dispatch bug along the way (see decision log). §1 docs also done this session (no code): `docs/whatsapp-runbook.md` (internal) + `docs-site/guides/whatsapp.mdx` (operator, wired into `docs.json` nav) + surgical accuracy fixes to `docs-site/guides/agent-templates.mdx` and `guides/campaigns.mdx` (they still described the old free-text WhatsApp body/sender-ID fields, pre-dating the smart-agent/template-id redesign). **All 35/35 tasks in `tasks.md` now checked.** `openspec validate whatsapp-channel --strict` passes. |
| 5   | Sync            | not started | Not run this session — deliberately out of scope for tonight's ask (docs + e2e only). `openspec validate` already passes; run `/opsx:sync whatsapp-channel` (or `/ps:ship whatsapp-channel` to continue the full pipeline) when you're ready to merge the delta specs into `openspec/specs/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | Archive         | pending     | Comes after sync.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-06-30 — **§1 docs — where things went and what was skipped:** split task 1.1's "site +
  internal runbook" as: customer-facing setup steps → `docs-site/guides/whatsapp.mdx` (Spanish,
  Mintlify, hosted-product-only per `docs-site/CLAUDE.md` — this is where an operator connecting
  their own WABA belongs, not the marketing `site/` landing page, which has no guide content of
  any kind); everything support/ops-facing (quality-rating monitoring, ban escalation, the
  132012-error explanation, "how to help a customer who's stuck") → `docs/whatsapp-runbook.md`
  (English, matches `docs/deploy.md`'s existing internal-doc convention). Deliberately did **not**
  run the `/ps:docs` skill's full ceremony (Pencil screenshots, Diagram Kit assets, ASSETS.md
  ledger) — that requires interactive gates this session shouldn't block on overnight, and the
  page reads fine as text-only; if you want the screenshots, that's a quick `/ps:docs` follow-up
  pass on the same page rather than a rewrite. Also fixed two now-stale spots found while writing
  this: `agent-templates.mdx` and `campaigns.mdx` still described WhatsApp with the old free-text
  message-body / sender-ID fields from before the template-id + smart-agent redesign (design.md
  decisions 3 and 9) — corrected in place rather than left contradicting the new guide.
- 2026-06-30 — **Bug fix found + fixed while writing §9.5's e2e test:** `engine.ts`
  (`reserveAndDispatch`) called `deps.resolveWhatsApp(workspaceRef, c.whatsAppSenderNumberId)`,
  passing the campaign's internal `WhatsAppSenderNumber.id` (a UUID) where `resolveWhatsAppClient`
  expects Meta's own `phoneNumberId` (used verbatim as the Graph API path segment in
  `MetaWhatsAppClient`). Every live WHATSAPP dispatch would have called
  `graph.facebook.com/{internal-uuid}/messages` and failed. Fixed by joining
  `whatsAppSenderNumber.phoneNumberId` in `prismaEngineClient.listActiveCampaigns` onto a new
  `EngineCampaign.whatsAppSenderPhoneNumberId` field, and switching the `resolveWhatsApp` call
  site to use it instead of the FK id (`whatsAppSenderNumberId` is kept, still used for the
  "was a sender chosen" readiness check). Not caught earlier because unit tests (§9.1) inject
  the client directly and never exercise `engine.ts`'s real call site, and §9.5 (this e2e) was
  the first test to actually run `resolveWhatsApp` through the engine tick. Verified via
  `mods/apiserver/src/engine/whatsapp.integration.test.ts` (new) + full `npm test` (170/170,
  ×3 clean runs — apiserver). No decision needed here beyond "fix it," flagging per your
  standing ask to leave a note when I make a unilateral call overnight.
- 2026-06-30 — Ship checkpoint stage table was stale (still read "stage 3, §6.2/§7/§8/§9
  remaining") even though `tasks.md` and `main` already had all of §2–§8 committed by the time
  this session picked the change back up. Corrected below; §1 (docs) and §9.5 (e2e) were the
  only genuinely open items.
- 2026-06-30 — Integraciones reachable via the **avatar menu** (`Comp/User Menu` lKDuM), next to Miembros + Configuración del espacio (not the sidebar). Reusable component → all instances update.

- 2026-06-30 — Build: §2 contracts done (DispatchChannel/WhatsAppClient/integration+webhook schemas/agent-template fields), §3 data model done (Prisma models + migration `20260630120000_whatsapp_channel` via migrate-diff; cloak via prisma-field-encryption@1.6.0 + conditional db.ts extension; config `security.cloakEncryptionKey`+`whatsapp` block). common + apiserver typecheck green. Language moved off WorkspaceSettings → `WhatsAppIntegration.defaultLanguage` (user request: keep WA config together).
- 2026-06-30 — Gate feedback: simplified the Voz IA gestión block — removed the big `PromesaCallout` medallion, payment promise now a simple card beside Sentimiento (matches other agents' simplicity). Integraciones page is a standalone frame `NeB6V` at ~x:7720; sidebar has no Integraciones nav item yet (offered to add).

- 2026-06-30 — **SCOPE: WhatsApp agents are "smart" like EMAIL.** The WHATSAPP agent gains `systemPrompt` + `maxAgentReplies` (mirror EmailConfig); the opening message is the approved template (template-id → read-only preview), then the AI agent converses within Meta's 24h window. Stage 2 must add these to WhatsAppConfig + the create-agent schema, and the dispatch/inbound flow must support AI replies (not just one-shot template send). Modal rebuilt by copying the email modal (also dodges the +50px insert bug).
- 2026-06-30 — **SCOPE: two more screens requested** — "Detalles de gestión" (WhatsApp gestión detail) and the integration-config screen (Workspace Integrations).
- 2026-06-30 — Hit the documented +50px raw-node shift bug when inserting caption nodes; switched to copy-existing-modal approach per the project Pencil workaround.
- 2026-06-30 — Late design decisions folded in pre-ship: language sourced from **workspace** setting (option D; `preferredLanguage` to be deprecated; no `language` on WhatsAppConfig/sender); WHATSAPP agent modal is **template-id-driven + read-only** (fetch template body from WABA for preview). Change re-validated.
- 2026-06-30 — Frame done. All 4 surfaces present. Moving to Design.
- 2026-06-30 — Checkpoint created; framing the change.
