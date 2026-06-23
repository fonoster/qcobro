import twilio from "twilio";
import type { SmsClient, TwilioConfig } from "@qcobro/common";

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

/** Twilio-backed {@link SmsClient}. Sends a single SMS and returns its message sid. */
export class TwilioSmsClient implements SmsClient {
  private readonly client: ReturnType<typeof twilio>;

  constructor(settings: TwilioSettings) {
    this.client = twilio(settings.accountSid, settings.authToken);
  }

  async sendMessage(input: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    const message = await withTimeout(
      this.client.messages.create({ from: input.from, to: input.to, body: input.body }),
      "messages.create"
    );
    return { sid: message.sid };
  }
}
