import type {
  WhatsAppClient,
  WhatsAppFetchedTemplate,
  WhatsAppSendTemplateInput
} from "@qcobro/common";

/** Cap the provider call so an unreachable Meta endpoint can't hang the request/tick path. */
const SEND_TIMEOUT_MS = 15_000;

/** Settings to build a per-call WhatsApp client from a workspace integration + selected sender. */
export interface MetaWhatsAppSettings {
  /** Meta per-number messaging endpoint id (the selected sender). */
  phoneNumberId: string;
  /** Tenant WABA access token (decrypted just-in-time by the caller). */
  accessToken: string;
  /** WABA id — needed to list message templates for the preview. */
  wabaId: string;
  /** Graph API base, from config (e.g. `https://graph.facebook.com`). */
  apiBaseUrl: string;
  /** Graph API version, from config (e.g. `v18.0`). */
  apiVersion: string;
}

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number; type?: string };
}

interface MetaTemplateListResponse {
  data?: Array<{
    id?: string;
    name?: string;
    language?: string;
    status?: string;
    components?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string; code?: number };
}

/**
 * Meta Cloud API-backed {@link WhatsAppClient}. Talks to the Graph API directly (no SDK,
 * matching the repo's vendor-API convention; ported from `../mikro/.../client/sendMessage.ts`
 * and reduced to the three surfaces QCobro needs). Built per-dispatch from the owning
 * workspace's integration because credentials are tenant-owned and cannot be injected once
 * at boot like the voice/SMS pools.
 *
 * The opener is always an approved template with **named** parameters — each
 * `{ parameter_name, text }` matches a `{{placeholder}}` in the template by name. Free-form
 * `sendText` is valid only inside Meta's 24h customer-service window (enforced upstream).
 */
export class MetaWhatsAppClient implements WhatsAppClient {
  constructor(private readonly settings: MetaWhatsAppSettings) {}

  private get messagesUrl(): string {
    const { apiBaseUrl, apiVersion, phoneNumberId } = this.settings;
    return `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
  }

  private async post(body: Record<string, unknown>): Promise<{ id: string }> {
    const res = await fetch(this.messagesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    const data = (await res.json().catch(() => ({}))) as MetaSendResponse;
    if (!res.ok) {
      const message = data.error?.message ?? `HTTP ${res.status}`;
      const code = data.error?.code;
      throw new Error(`WhatsApp API error: ${message}${code ? ` (Code: ${code})` : ""}`);
    }
    const id = data.messages?.[0]?.id;
    if (!id) throw new Error("WhatsApp API returned no message id");
    return { id };
  }

  async sendTemplate(input: WhatsAppSendTemplateInput): Promise<{ id: string }> {
    const components =
      input.params.length > 0
        ? [
            {
              type: "body",
              parameters: input.params.map((p) => ({
                type: "text",
                parameter_name: p.parameterName,
                text: p.text
              }))
            }
          ]
        : [];
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components
      }
    });
  }

  async sendText(input: { to: string; body: string }): Promise<{ id: string }> {
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { body: input.body }
    });
  }

  /**
   * Fetch a template by id for the modal preview. Meta exposes templates per WABA (not by
   * id directly), so we list the WABA's templates and match. Returns null when the id is
   * unknown. The body is the text of the template's BODY component.
   */
  async fetchTemplate(templateId: string): Promise<WhatsAppFetchedTemplate | null> {
    const { apiBaseUrl, apiVersion, wabaId, accessToken } = this.settings;
    const url = `${apiBaseUrl}/${apiVersion}/${wabaId}/message_templates?limit=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    const data = (await res.json().catch(() => ({}))) as MetaTemplateListResponse;
    if (!res.ok) {
      const message = data.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`WhatsApp template fetch failed: ${message}`);
    }
    const found = (data.data ?? []).find((t) => t.id === templateId);
    if (!found) return null;
    const body = found.components?.find((c) => c.type === "BODY")?.text ?? "";
    return {
      id: found.id ?? templateId,
      name: found.name ?? "",
      language: found.language ?? "",
      body,
      status: found.status ?? ""
    };
  }
}
