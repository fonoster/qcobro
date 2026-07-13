import type {
  WhatsAppClient,
  WhatsAppFetchedTemplate,
  WhatsAppSendTemplateInput
} from "@qcobro/common";

/** Cap the provider call so an unreachable Meta endpoint can't hang the request/tick path. */
const SEND_TIMEOUT_MS = 15_000;

/** Retry policy for `fetchTemplate` reads (transient 5xx / network errors only). */
const FETCH_TEMPLATE_MAX_ATTEMPTS = 3;
const FETCH_TEMPLATE_BASE_DELAY_MS = 300;

/** Thrown by a failed attempt so the retry loop can tell transient from permanent failures. */
class MetaHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 5xx and 429 are worth retrying; 4xx auth/permission/not-found errors are not. */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

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
   *
   * Retries transient failures (5xx / 429 / network errors) with exponential backoff — the
   * agent-template create/edit modal depends on this call to populate the preview, and a
   * one-off blip from Meta shouldn't block creating a WhatsApp agent. 4xx auth/permission
   * errors are not retried since they won't succeed on a second try. Unlike `sendTemplate`/
   * `sendText`, retrying here is safe: it's a read with no side effects.
   */
  async fetchTemplate(templateId: string): Promise<WhatsAppFetchedTemplate | null> {
    const data = await this.withRetry(() => this.listTemplates());
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

  private async listTemplates(): Promise<MetaTemplateListResponse> {
    const { apiBaseUrl, apiVersion, wabaId, accessToken } = this.settings;
    const url = `${apiBaseUrl}/${apiVersion}/${wabaId}/message_templates?limit=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    const data = (await res.json().catch(() => ({}))) as MetaTemplateListResponse;
    if (!res.ok) {
      const message = data.error?.message ?? `HTTP ${res.status}`;
      throw new MetaHttpError(`WhatsApp template fetch failed: ${message}`, res.status);
    }
    return data;
  }

  /**
   * Runs `attempt` up to {@link FETCH_TEMPLATE_MAX_ATTEMPTS} times with exponential backoff,
   * retrying only transient failures: a {@link MetaHttpError} with a retryable status, or any
   * other error (network failure, timeout) which has no status to classify by. A non-retryable
   * `MetaHttpError` (4xx) is rethrown immediately.
   */
  private async withRetry<T>(attempt: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < FETCH_TEMPLATE_MAX_ATTEMPTS; i++) {
      try {
        return await attempt();
      } catch (err) {
        lastError = err;
        const retryable = !(err instanceof MetaHttpError) || isRetryableStatus(err.status);
        const isLastAttempt = i === FETCH_TEMPLATE_MAX_ATTEMPTS - 1;
        if (!retryable || isLastAttempt) throw err;
        await sleep(FETCH_TEMPLATE_BASE_DELAY_MS * 2 ** i);
      }
    }
    // Unreachable — the loop always returns or throws — but keeps the compiler happy.
    throw lastError;
  }

  /**
   * Lightweight reachability check for the Workspace Integrations "connected" badge: confirms
   * the stored token can still read the WABA, instead of assuming a stored row means a live
   * connection. No side effects; never throws — a network error is "not connected", not a
   * crash of the integration read.
   */
  async checkConnection(): Promise<boolean> {
    const { apiBaseUrl, apiVersion, wabaId, accessToken } = this.settings;
    const url = `${apiBaseUrl}/${apiVersion}/${wabaId}?fields=id`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/** Settings needed to check whether a workspace's WABA/token are still reachable. */
export type WhatsAppConnectionCheckSettings = Pick<
  MetaWhatsAppSettings,
  "wabaId" | "accessToken" | "apiBaseUrl" | "apiVersion"
>;

/** Default {@link WhatsAppConnectionChecker} — builds a client from settings and checks it. */
export function checkWhatsAppConnection(
  settings: WhatsAppConnectionCheckSettings
): Promise<boolean> {
  return new MetaWhatsAppClient({ phoneNumberId: "", ...settings }).checkConnection();
}
