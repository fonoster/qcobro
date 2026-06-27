import type { EmailClient, EmailSendInput, ResendConfig } from "@qcobro/common";

type ResendSettings = NonNullable<ResendConfig>;

/** Cap the provider call so an unreachable Resend can't hang the request/tick path. */
const SEND_TIMEOUT_MS = 15_000;

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
    const res = await fetch("https://api.resend.com/emails", {
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
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error("Resend send returned no message id");
    return { id: data.id };
  }
}
