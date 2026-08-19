import twilio from "twilio";
import { DispatchError, type SmsClient, type TwilioConfig } from "@qcobro/common";

type TwilioSettings = NonNullable<TwilioConfig>;

/** Cap the provider call so an unreachable Twilio can't hang the request path. */
const SEND_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Twilio ${label} timed out`)), SEND_TIMEOUT_MS)
    )
  ]);
}

/** The `twilio` SDK throws `RestException`s carrying an HTTP `status` and a Twilio `code`. */
interface TwilioRestError {
  status?: number;
  code?: number;
  message?: string;
}

function isTwilioRestError(err: unknown): err is TwilioRestError {
  return typeof err === "object" && err !== null && "status" in err;
}

/**
 * Classifies a failed `messages.create` call. 401/403 (auth), 429 (rate limited), and 5xx
 * mean Twilio couldn't evaluate the send at all; any other coded rejection (invalid/
 * unreachable number, unsubscribed recipient) means Twilio evaluated the destination and
 * refused it. A timeout or network failure has no `status` to classify by, so it falls
 * back to `SYSTEM_ERROR` — never `DELIVERY_REJECTED` for an error we can't read.
 */
export function classifySmsError(err: unknown): DispatchError {
  if (isTwilioRestError(err) && typeof err.status === "number") {
    const { status, code, message } = err;
    const detail = `Twilio SMS error${code ? ` (code ${code})` : ""}: ${message ?? `HTTP ${status}`}`;
    const kind =
      status === 401 || status === 403 || status === 429 || status >= 500
        ? "SYSTEM_ERROR"
        : "DELIVERY_REJECTED";
    return new DispatchError(kind, detail, { cause: err });
  }
  return new DispatchError(
    "SYSTEM_ERROR",
    `Twilio SMS send failed: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err }
  );
}

/**
 * Builds the Twilio `statusCallback` URL from a configured `webhookBaseUrl`, or `undefined`
 * when unconfigured (SMS then sends exactly as fire-and-forget as it does without this
 * capability). Pulled out as a pure function so the URL-building logic is unit-testable
 * without mocking the `twilio` SDK client itself.
 */
export function buildSmsStatusCallbackUrl(webhookBaseUrl?: string): string | undefined {
  return webhookBaseUrl ? `${webhookBaseUrl.replace(/\/+$/, "")}/api/sms/events` : undefined;
}

/** Twilio-backed {@link SmsClient}. Sends a single SMS and returns its message sid. */
export class TwilioSmsClient implements SmsClient {
  private readonly client: ReturnType<typeof twilio>;
  /** Registered with every send when configured; see the sms-events-hook capability. */
  private readonly statusCallback: string | undefined;

  constructor(settings: TwilioSettings) {
    this.client = twilio(settings.accountSid, settings.authToken);
    this.statusCallback = buildSmsStatusCallbackUrl(settings.webhookBaseUrl);
  }

  async sendMessage(input: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    try {
      const message = await withTimeout(
        this.client.messages.create({
          from: input.from,
          to: input.to,
          body: input.body,
          ...(this.statusCallback ? { statusCallback: this.statusCallback } : {})
        }),
        "messages.create"
      );
      return { sid: message.sid };
    } catch (err) {
      throw classifySmsError(err);
    }
  }
}
