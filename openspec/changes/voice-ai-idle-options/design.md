## Context

PR #165 added a shared `idleOptions` block (`message` + `timeout` 4500 ms +
`maxTimeoutCount` 3) to `mods/apiserver/src/services/autopilotTemplate.json`. Both
`FonosterVoiceApplicationClient.buildRequest()` (sync path) and `.evaluate()` (ephemeral
eval path) spread `autopilotTemplate.conversationSettings` wholesale, so every synced Voz
IA app and every eval run inherits the same idle behavior.

Idle timing is a per-agent conversational concern: the re-engagement line depends on the
agent's persona and the collection script, and silence tolerance depends on the audience.
It should be editable per template, like `systemPrompt` and `firstMessage`.

Constraints:

- `evalTemplateSchema` (`mods/common/src/schemas/agentEvaluations.ts`) `.extend`s the
  exact VOICE_AI member of `createAgentTemplateSchema`. Eval YAMLs must not have to carry
  idle options — `agents:eval` exercises `evaluateIntelligence`, a stateless LLM judge
  that never runs the live-call idle state machine.
- `mods/ctl agents:create` builds its payload straight from the schema; adding required
  fields with no default would break existing CLI invocations.
- DB columns must be NOT NULL — every stored template and every synced Fonoster app must
  carry real values, not nulls.
- Docker/Postgres may be unavailable in the build environment; the migration must be
  written to the repo's established style even if it cannot be run live here.

## Goals / Non-Goals

**Goals:**

- Three editable per-template fields (`idleMessage`, `idleTimeout` ms, `idleMaxTimeoutCount`)
  on VOICE_AI templates, persisted NOT NULL, surfaced in the console form and detail page.
- One shared default constant in `@qcobro/common`, used by the migration backfill, the
  console create-form pre-fill, and the eval/ephemeral Fonoster path.
- `buildRequest()` sources `idleOptions` from the template; `evaluate()` from the constant.
- Eval YAMLs and `agents:create` calls that omit the fields keep working unchanged.
- Deployment default `timeout` moves 4500 → 8000 ms, superseding PR #165 for backfilled rows.

**Non-Goals:**

- No new CLI flags on `agents:create` (defaults cover it).
- No per-portfolio or per-campaign idle overrides — template-level only.
- No change to `VOICE_PRERECORDED` (it has no idle concept) or to the other channels.
- No runtime tuning of the idle state machine itself; QCobro only forwards the three
  values to Fonoster's `conversationSettings.idleOptions`.

## Decisions

### 1. `.default(...)` on the schema fields, pointing at one exported constant

`mods/common/src/schemas/agentTemplates.ts` gains:

```ts
export const DEFAULT_VOICE_IDLE_OPTIONS = {
  message: "¿Se encuentra en la línea? Necesito confirmar una fecha de pago para su cuenta.",
  timeout: 8000,
  maxTimeoutCount: 3
} as const;
```

The VOICE_AI member of `createAgentTemplateSchema` gains:

```ts
idleMessage: z.string().min(1).default(DEFAULT_VOICE_IDLE_OPTIONS.message),
idleTimeout: z.number().int().min(3000).default(DEFAULT_VOICE_IDLE_OPTIONS.timeout),
idleMaxTimeoutCount: z.number().int().min(1).default(DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount),
```

Rationale: `.default()` means `evalTemplateSchema`'s `.extend` and any `agents:create`
call that omits the keys still parse and receive the defaults — "required" is enforced
where it actually matters (DB NOT NULL, console form validation, always-present in the
synced app), not in the shared Zod shape. Alternative considered: a separate
`voiceAiIdleSchema` merged only into the create path — rejected because the eval schema
destructures `createAgentTemplateSchema.options` positionally and expects the VOICE_AI
member to be self-contained.

Constant lives in `agentTemplates.ts` (not a new `constants.ts`) so it sits next to the
schema that references it and is re-exported through the existing `@qcobro/common` barrel.

### 2. NOT NULL columns with a backfill migration

`model VoiceAiConfig` gains `idleMessage String`, `idleTimeout Int`,
`idleMaxTimeoutCount Int` (all non-optional). The migration follows the repo's
add-then-backfill-then-constrain pattern (see
`20260819120000_contact_log_axes`):

```sql
ALTER TABLE "voice_ai_configs" ADD COLUMN "idleMessage" TEXT;
ALTER TABLE "voice_ai_configs" ADD COLUMN "idleTimeout" INTEGER;
ALTER TABLE "voice_ai_configs" ADD COLUMN "idleMaxTimeoutCount" INTEGER;

UPDATE "voice_ai_configs" SET
  "idleMessage" = '¿Se encuentra en la línea? Necesito confirmar una fecha de pago para su cuenta.',
  "idleTimeout" = 8000,
  "idleMaxTimeoutCount" = 3
WHERE "idleMessage" IS NULL;

ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleMessage" SET NOT NULL;
ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleTimeout" SET NOT NULL;
ALTER TABLE "voice_ai_configs" ALTER COLUMN "idleMaxTimeoutCount" SET NOT NULL;
```

The literal default values are duplicated into the SQL (migrations must be
self-contained and frozen), with a comment pointing at `DEFAULT_VOICE_IDLE_OPTIONS` as
the source of truth. `idleTimeout: 8000` deliberately supersedes PR #165's 4500 for
already-created templates — confirmed with the user; they re-sync to pick it up.

### 3. `buildRequest()` from the input, `evaluate()` from the constant

`VoiceApplicationInput` gains `idleMessage: string`, `idleTimeout: number`,
`idleMaxTimeoutCount: number`. `syncVoiceApplication.ts` forwards the three
`VoiceAiConfig` columns into that input. `buildRequest()` builds:

```ts
conversationSettings: {
  ...autopilotTemplate.conversationSettings,
  ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
  systemPrompt: input.systemPrompt,
  idleOptions: {
    message: input.idleMessage,
    timeout: input.idleTimeout,
    maxTimeoutCount: input.idleMaxTimeoutCount
  }
}
```

`evaluate()` has no template row (ephemeral YAML agent), so it builds `idleOptions` from
`DEFAULT_VOICE_IDLE_OPTIONS` directly. `idleOptions` is removed from
`autopilotTemplate.json` entirely — both paths now set it explicitly — keeping
`allowUserBargeIn`, `goodbyeMessage`, `systemErrorMessage`. `scripts/assets/autopilot.yaml`
is aligned to the new default so the scaffold matches the runtime template.

### 4. Console form: milliseconds shown raw

The form shows and stores raw milliseconds (no seconds↔ms conversion). `idleTimeout` and
`idleMaxTimeoutCount` are number inputs with a `placeholder` example (`8000`, `3`) and a
hint like "En milisegundos. 8000 = 8 segundos." `idleMessage` is a content field → a
`hint` with an example starting `Ej.: ` and a `{{variable}}` where natural. All three are
pre-filled on the create form from `DEFAULT_VOICE_IDLE_OPTIONS` and required (no empty
submit). Edit wires them through the loose `config` bag, which already flows arbitrary
`VoiceAiConfig` keys.

## Risks / Trade-offs

- **[Backfill changes behavior for existing templates]** → Intentional and user-confirmed:
  `idleTimeout` 4500 → 8000. Documented in the PR body; existing agents are unaffected
  until their next re-sync, at which point `buildRequest()` sends the stored 8000.
- **[Migration cannot be run live without Postgres]** → Written to the repo's frozen-SQL
  style and validated by inspection; PR body notes it was not applied live and e2e is
  pending a stack. `prisma migrate` on the next environment with a DB will apply it.
- **[Literal default duplicated in SQL and TS]** → Unavoidable (migrations are frozen).
  Mitigated by a comment cross-referencing the constant and a `mods/common` unit test
  asserting the constant's values, so drift is caught.
- **[`.default()` masks a genuinely missing value in a future caller]** → Acceptable: the
  console form enforces non-empty independently, and any new programmatic caller that
  wants explicit control simply passes the fields.

## Migration Plan

1. Ship `mods/common` (constant + schema + types), build the package.
2. Apply the Prisma migration in each environment (`prisma migrate deploy`): adds columns,
   backfills from the constant's values, sets NOT NULL.
3. Deploy apiserver + webapp together.
4. Existing Voz IA templates carry the backfilled values immediately in the DB and detail
   page; the synced Fonoster app updates on the operator's next save/re-sync of that
   template (or a manual "Sincronizar").

Rollback: revert the code deploy; the added columns are harmless to old code (it never
reads them). A full rollback of the column addition needs a `DROP COLUMN` follow-up
migration — not expected to be necessary.

## Open Questions

_None._
