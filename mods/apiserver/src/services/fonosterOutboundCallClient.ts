import * as SDK from "@fonoster/sdk";
import {
  DispatchError,
  type FonosterConfig,
  type OutboundCallClient,
  type OutboundCallInput,
  type VoiceCallLookupResult,
  type VoiceCallStatus
} from "@qcobro/common";

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

/** The Fonoster SDK's gRPC client throws `ServiceError`s carrying a numeric `.code` (grpc.status). */
interface GrpcServiceError {
  code?: number;
  message?: string;
}

function isGrpcServiceError(err: unknown): err is GrpcServiceError {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "number";
}

/** gRPC status code Fonoster returns from `Calls.getCall` when the ref has no CDR at all. */
const GRPC_NOT_FOUND = 5;

/**
 * `CallDetailRecord.endedAt` is typed as a plain `Date`, but for a call that has not cleared
 * yet an unset protobuf timestamp deserializes to the epoch (`new Date(0)`), not `undefined`.
 * Treat anything that isn't a real, positive instant as "not ended yet" — the sweep must
 * never mistake that for a real end time.
 */
function parseEndedAt(value: unknown): Date | null {
  if (!(value instanceof Date)) return null;
  const ms = value.getTime();
  return Number.isFinite(ms) && ms > 0 ? value : null;
}

/**
 * gRPC status codes that mean the call request was actually evaluated and rejected on the
 * destination/appRef side (INVALID_ARGUMENT, FAILED_PRECONDITION) rather than a transport,
 * auth (UNAUTHENTICATED/PERMISSION_DENIED), or availability failure.
 */
const DELIVERY_REJECTED_GRPC_CODES = new Set([
  3 /* INVALID_ARGUMENT */, 9 /* FAILED_PRECONDITION */
]);

/**
 * Classifies a failed login or `createCall`. A recognized carrier/invalid-destination gRPC
 * code is `DELIVERY_REJECTED`; everything else (auth, network, timeout, unclassified) falls
 * back to `SYSTEM_ERROR`, since only those two codes are ones we can confidently attribute
 * to the destination rather than to Fonoster/the transport.
 */
export function classifyVoiceError(err: unknown): DispatchError {
  if (isGrpcServiceError(err) && err.code !== undefined) {
    const kind = DELIVERY_REJECTED_GRPC_CODES.has(err.code) ? "DELIVERY_REJECTED" : "SYSTEM_ERROR";
    return new DispatchError(
      kind,
      `Fonoster call origination failed: ${err.message ?? `gRPC code ${err.code}`}`,
      { cause: err }
    );
  }
  return new DispatchError(
    "SYSTEM_ERROR",
    `Fonoster call origination failed: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err }
  );
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
  private clientPromise: Promise<SDK.Client> | null = null;

  constructor(settings: FonosterSettings) {
    this.settings = settings;
  }

  private client(): Promise<SDK.Client> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = new SDK.Client({
          accessKeyId: this.settings.accessKeyId,
          ...(this.settings.endpoint ? { endpoint: this.settings.endpoint } : {})
        } as ConstructorParameters<typeof SDK.Client>[0]);
        await client.loginWithApiKey(this.settings.apiKey, this.settings.apiSecret);
        return client;
      })().catch((err) => {
        // A failed login must not be memoized — otherwise one transient auth error
        // (expired key, network blip) permanently breaks every future call for the
        // life of this process, since clientPromise would stay set to a rejection.
        this.clientPromise = null;
        throw err;
      });
    }
    return this.clientPromise;
  }

  private async calls(): Promise<SDK.Calls> {
    return new SDK.Calls(await this.client());
  }

  async createCall(input: OutboundCallInput): Promise<{ ref: string }> {
    try {
      const calls = await withTimeout(this.calls(), "login");
      const { ref } = await withTimeout(
        calls.createCall({
          from: input.from,
          to: input.to,
          appRef: input.appRef,
          // Ring timeout, in seconds — unrelated to CALL_TIMEOUT_MS above, which caps
          // this dispatch RPC. Left unset, Fonoster applies its own 30s default, which
          // in practice leaves only ~21s of real ringing once SIP setup is paid for and
          // cancels calls a moment before slower recipients pick up.
          timeout: this.settings.callTimeoutSeconds,
          metadata: input.metadata
        }),
        "createCall"
      );
      return { ref };
    } catch (err) {
      throw classifyVoiceError(err);
    }
  }

  /**
   * Looks up a call's CDR by provider ref (the voice completion sweep's only consumer).
   * Fonoster answers a ref with no record at all — the call never originated — with a gRPC
   * `NOT_FOUND`, not a null; that is caught here and surfaced as `{ found: false }` rather
   * than left to throw, since the sweep needs to branch on it, not treat it as failure.
   */
  async getCall(ref: string): Promise<VoiceCallLookupResult> {
    try {
      const calls = await withTimeout(this.calls(), "login");
      const record = await withTimeout(calls.getCall(ref), "getCall");
      return {
        found: true,
        // The SDK's own CallStatus type omits UNKNOWN (the protobuf zero-value), so an
        // in-progress call's status can arrive as something outside that type at runtime.
        status: (record.status as unknown as VoiceCallStatus) || "UNKNOWN",
        setupToClearSeconds: record.duration ?? 0,
        endedAt: parseEndedAt(record.endedAt)
      };
    } catch (err) {
      if (isGrpcServiceError(err) && err.code === GRPC_NOT_FOUND) {
        return { found: false };
      }
      // Unlike createCall, a lookup failure isn't a dispatch outcome to classify — just
      // propagate it so the caller (the sweep) logs it and retries on its next pass.
      throw err;
    }
  }
}
