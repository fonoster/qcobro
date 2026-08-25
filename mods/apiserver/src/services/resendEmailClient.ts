import {
  DispatchError,
  type EmailClient,
  type EmailSendInput,
  type ReceivedEmail,
  type ResendConfig
} from "@qcobro/common";
import { PROVIDER_TIMEOUT_MS } from "./httpTimeouts.js";

type ResendSettings = NonNullable<ResendConfig>;

/** Cap the provider call so an unreachable Resend can't hang the request/tick path. */

/**
 * Resend-backed {@link EmailClient}. Sends a single email over Resend's REST API (no SDK
 * dependency, matching the repo's vendor-API convention) and returns the provider message
 * id. The per-attempt reply-to carries the correlation token; when this is a reply within a
 * thread, the upstream Message-ID is threaded via `In-Reply-To`/`References`.
 */
export class ResendEmailClient implements EmailClient {
  constructor(private readonly settings: ResendSettings) {}

  async sendEmail(input: EmailSendInput): Promise<{ id: string }> {
    const from = input.fromName ? `${input.fromName} <${input.from}>` : input.from;
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          text: input.body,
          reply_to: [input.replyTo],
          ...(input.inReplyTo
            ? { headers: { "In-Reply-To": input.inReplyTo, References: input.inReplyTo } }
            : {})
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
      });
    } catch (err) {
      // Never reached Resend at all — network failure or our own timeout abort.
      throw new DispatchError(
        "SYSTEM_ERROR",
        `Resend send request failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // 401/403 (auth), 429 (rate limited), 5xx mean Resend couldn't evaluate the send at
      // all. Any other rejection (invalid from/to address, hard bounce at send time) means
      // Resend evaluated the request and refused it.
      const kind =
        res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500
          ? "SYSTEM_ERROR"
          : "DELIVERY_REJECTED";
      throw new DispatchError(kind, `Resend send failed (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new DispatchError("SYSTEM_ERROR", "Resend send returned no message id");
    return { id: data.id };
  }

  /**
   * Fetch a received inbound email by id. The `email.received` webhook is metadata-only
   * (no body), so the inbound handler calls this to retrieve `text`/`html` before
   * ingesting the reply. Returns null on 404 (not yet retrievable / unknown id).
   */
  async getReceivedEmail(id: string): Promise<ReceivedEmail | null> {
    const res = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend receive fetch failed (${res.status}): ${detail}`);
    }
    const d = (await res.json()) as {
      id?: string;
      from?: string;
      to?: string[];
      subject?: string;
      text?: string | null;
      html?: string | null;
      message_id?: string;
      headers?: Record<string, string>;
    };
    return {
      id: d.id ?? id,
      from: d.from ?? "",
      to: Array.isArray(d.to) ? d.to : [],
      subject: d.subject,
      text: d.text ?? null,
      html: d.html ?? null,
      messageId: d.message_id,
      headers: d.headers
    };
  }
}
