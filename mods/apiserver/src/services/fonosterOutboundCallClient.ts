import * as SDK from "@fonoster/sdk";
import type { FonosterConfig, OutboundCallClient, OutboundCallInput } from "@qcobro/common";

type FonosterSettings = NonNullable<FonosterConfig>;

/** Cap provider calls so an unreachable Fonoster can't hang the request path. */
const CALL_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Fonoster ${label} timed out`)), CALL_TIMEOUT_MS)
    )
  ]);
}

/**
 * Fonoster-backed {@link OutboundCallClient}. Originates outbound calls to a
 * synced AUTOPILOT application (`appRef`); the rendered, per-customer payload
 * rides along as call `metadata` so personalization needs no app re-sync.
 *
 * Auth mirrors {@link FonosterVoiceApplicationClient}: a workspace access key,
 * then an API key/secret login. The login promise is memoized once it succeeds,
 * so login only happens once per process; a failed login is not memoized and is
 * retried on the next call.
 */
export class FonosterOutboundCallClient implements OutboundCallClient {
  private readonly settings: FonosterSettings;
  private callsPromise: Promise<SDK.Calls> | null = null;

  constructor(settings: FonosterSettings) {
    this.settings = settings;
  }

  private calls(): Promise<SDK.Calls> {
    if (!this.callsPromise) {
      this.callsPromise = (async () => {
        const client = new SDK.Client({
          accessKeyId: this.settings.accessKeyId,
          ...(this.settings.endpoint ? { endpoint: this.settings.endpoint } : {})
        } as ConstructorParameters<typeof SDK.Client>[0]);
        await client.loginWithApiKey(this.settings.apiKey, this.settings.apiSecret);
        return new SDK.Calls(client);
      })().catch((err) => {
        // A failed login must not be memoized — otherwise one transient auth error
        // (expired key, network blip) permanently breaks every future call for the
        // life of this process, since callsPromise would stay set to a rejection.
        this.callsPromise = null;
        throw err;
      });
    }
    return this.callsPromise;
  }

  async createCall(input: OutboundCallInput): Promise<{ ref: string }> {
    const calls = await withTimeout(this.calls(), "login");
    const { ref } = await withTimeout(
      calls.createCall({
        from: input.from,
        to: input.to,
        appRef: input.appRef,
        metadata: input.metadata
      }),
      "createCall"
    );
    return { ref };
  }
}
