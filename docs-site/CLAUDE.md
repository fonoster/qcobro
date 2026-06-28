# QCobro docs — editorial policy

Project-specific guidance for everything under `docs-site/` (the Mintlify docs and their
assets). Authored with `/ps:docs`. This is the _what's-allowed-and-for-whom_ layer; the
_how-to-write_ method lives in the skill, the coding conventions in the repo-root
`CLAUDE.md`, and the asset mechanics in `images/ASSETS.md` — don't restate those here.

## Scope — the hosted product only

These docs describe **the hosted QCobro service**. There is exactly one audience: **people
who use hosted QCobro** — operators working in the console, and developers integrating with
the hosted product through the `@qcobro/sdk` and the public API. There are no tiers and no
self-hosting reader.

## Language — Spanish, for now

Write all docs in **Spanish** (`es`) for now: prose, headings, frontmatter `title` /
`description`, image `alt` text, and callouts. Keep in their original form: code blocks and
identifiers, API/SDK names, package names, product/feature names, and anything in `code`
font. This is the docs' **authoring language** — it does **not** contradict the fact that
the _product_ is multilingual; never describe QCobro itself as Spanish-only.

## Out of scope — never document

- **Self-hosting & deployment** — running QCobro yourself, Docker, infrastructure,
  migrations, environment setup. Users don't deploy QCobro; we host it.
- **Configuration files** — `qcobro.json` or any deployment/config file. Settings the
  customer changes happen **in the console**, and are documented as console actions.
- **Internals** — the database and data layer (Prisma), internal services (e.g. Identity),
  internal types/classes (`OutboundCallClient`, `SmsClient`, `DispatchResult`), the
  campaigns engine's machinery, or the console's tech stack.

The public API protocol the SDK exposes is **not** internal: integrators call it directly
(including the `client.trpc` escape hatch), so the API/SDK reference may name and document
it. The line is the DB, the data layer, internal services, and how we run it — not the
contract integrators code against.

## Voice

Fonoster house voice: second person, present-tense imperative, active, short sentences,
task-first; precede every code block with a sentence saying what it does. QCobro is
**multilingual** — never describe it as Spanish-only, and don't hardcode a default language.

## The disclosure rule

> _Does the hosted user touch, configure (in the console), or observe this?_ If yes,
> document it. If it's only _how we implement or run it_, leave it out — and where you must
> refer to it, describe the **behavior**, not the **mechanism**.

### OK vs too much

✅ Talk about: the operator console and its flows (workspaces, portfolios, campaigns, agent
templates, payment promises, AI insights); integrating via `@qcobro/sdk` and the public API
(authentication with login / API keys, the contact-log endpoint); channels (voice call,
SMS, email) and what the user sees; outcomes, statuses, and behavior.

❌ Don't expose: deployment/self-hosting, `qcobro.json` or config files, which database we
use, the data layer (Prisma), internal service names (Identity), internal class/type names,
engine internals, or the console's tech stack.

When tempted to name a mechanism, name the **behavior** instead: "QCobro reaches your
customers by voice, SMS, or email" — not "dispatchOutreach calls the injected
OutboundCallClient"; "the SDK calls the QCobro API" — not "it reads from our PostgreSQL
database".

## Assets

Diagrams and images obey the same rule — no internals, no infrastructure, no config files.
A diagram that names internal types/services or a database does not belong in these docs.
Build assets from the Diagram Kit and register each in `images/ASSETS.md` — see there.
