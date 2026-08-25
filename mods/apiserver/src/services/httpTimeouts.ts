/**
 * Timeouts for outbound HTTP, as `AbortSignal.timeout(...)` budgets.
 *
 * `fetch` has no default timeout: a peer that accepts the connection and then never
 * responds leaves the request pending indefinitely. On the dispatch path that stalls a tick;
 * on the request path it pins an Express handler — and everything its closure holds, such as
 * a full email thread or conversation transcript — until the process restarts. Sockets are
 * finite, so enough stuck requests eventually starve the pool.
 *
 * The budgets differ because the work differs. A single constant would either cut off
 * legitimate LLM generation or leave a fast provider call hanging for a minute, so they are
 * named for the kind of call rather than shared.
 */

/**
 * A provider API call that should return promptly: send an SMS, post a WhatsApp message,
 * hand an email to Resend, ask Identity a question. Matches the budget already used on the
 * dispatch clients.
 */
export const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Text-to-speech synthesis. Slower than a plain API call — the provider renders audio before
 * responding, and a long script takes longer — but still bounded well under the LLM budget.
 */
export const TTS_TIMEOUT_MS = 30_000;

/**
 * LLM generation (autopilot replies, insights, similarity judging). Deliberately the most
 * generous: these routinely take tens of seconds under load, and cutting off a real response
 * is worse than waiting, since the caller has no cheaper way to get the answer. It is a
 * bound against hanging forever, not a latency target.
 */
export const LLM_TIMEOUT_MS = 60_000;
