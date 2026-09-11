import type { EmailThreadMessage } from "../types/email.js";

/**
 * The part of a gestión's `channelData` that carries the initial outbound message.
 * Dispatch writes these flat fields; the reply thread lives separately under
 * `emailThread` / `whatsAppThread`.
 */
interface OpenerSource {
  from?: unknown;
  subject?: unknown;
  messageBody?: unknown;
}

/**
 * Prepends the initial outbound message (the collection notice we sent) to a reply
 * thread, so a conversation reads as the whole exchange rather than starting at the
 * customer's first reply.
 *
 * Dispatch stores that notice as flat `channelData.messageBody`/`subject` fields, not as
 * a thread message — `emailThread`/`whatsAppThread` are only created once the first reply
 * arrives. Without this, the autopilot's first-ever view of a conversation is that reply,
 * so it cannot answer "¿de qué trata esto?", cite a link that appeared only in the notice,
 * or reference its subject line.
 *
 * Deliberately **not** persisted back into `channelData`. Building it here, at the point of
 * use, keeps `messageBody` the single source of truth for the notice, needs no migration or
 * backfill, and works for gestiones already in flight. It also avoids the console rendering
 * the notice twice, since `GestionDetail` already shows `messageBody` above the thread.
 *
 * @param channelData the gestión's `channelData` (any shape; missing fields are tolerated)
 * @param messages the reply thread as stored, oldest first
 * @returns `[opener, ...messages]`, or `messages` unchanged when there is no notice to add
 */
export function buildThreadWithOpener(
  channelData: unknown,
  messages: EmailThreadMessage[]
): EmailThreadMessage[] {
  const cd = (channelData ?? {}) as OpenerSource;
  const body = typeof cd.messageBody === "string" ? cd.messageBody : "";
  if (!body) return messages;

  const opener: EmailThreadMessage = {
    direction: "outbound",
    from: typeof cd.from === "string" && cd.from ? cd.from : "agent",
    // The notice's send time lives on the gestión (`contactedAt`), not in `channelData`,
    // and no prompt renderer reads `at`. Left empty rather than invented.
    at: "",
    body
  };
  if (typeof cd.subject === "string" && cd.subject) opener.subject = cd.subject;

  return [opener, ...messages];
}
