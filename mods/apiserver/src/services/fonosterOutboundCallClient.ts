import { getLogger } from "@fonoster/logger";
import * as SDK from "@fonoster/sdk";
import {
  DispatchError,
  type AmdStatus,
  type FonosterConfig,
  type OutboundCallClient,
  type OutboundCallInput,
  type VoiceCallLookupResult,
  type VoiceCallStatus
} from "@qcobro/common";

const logger = getLogger({ service: "fonoster-outbound-call-client", filePath: import.meta.url });

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
 * Below this magnitude a numeric epoch is seconds, not milliseconds. Real epoch-seconds
 * values are order 1e9 for the foreseeable future (only reaching 1e10 around the year 2286);
 * real epoch-milliseconds values for any recent or upcoming date are order 1e12+. 1e11 sits
 * cleanly between the two.
 */
const EPOCH_SECONDS_MAGNITUDE_CUTOFF = 1e11;

/**
 * `@fonoster/types` declares `CallDetailRecord.endedAt` as a `Date`, but the wire disagrees:
 * the proto field is `int32 ended_at = 6`, an epoch-**seconds** integer written verbatim into
 * InfluxDB with nothing in Fonoster's apiserver or SDK converting it — so at runtime this is
 * almost certainly a `number` (and, through some client paths, a numeric `string`), not a
 * `Date`. Accepts all three shapes rather than trusting the declared type, the same way
 * `getCall` already treats `status`/`duration` as unreliable. Rejects only genuinely unusable
 * values: non-finite, `<= 0` (the protobuf zero-value for a call that hasn't cleared), or
 * unparseable — the sweep must never mistake any of those for a real end time.
 */
export function parseEndedAt(value: unknown): Date | null {
  let ms: number;
  if (value instanceof Date) {
    ms = value.getTime();
  } else if (typeof value === "number") {
    ms = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    ms = Number(value);
  } else {
    return null;
  }
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms < EPOCH_SECONDS_MAGNITUDE_CUTOFF) ms *= 1000;
  return new Date(ms);
}

const VALID_AMD_STATUSES = new Set<AmdStatus>(["HUMAN", "MACHINE", "UNKNOWN"]);

// TODO(voice-amd-detection): drop this local cast once fonoster/fonoster#897 lands —
// `calls.proto`'s `CallDetailRecord` (returned by `Calls.getCall()`) does not carry an AMD
// verdict at all as of @fonoster/sdk 0.23.0 (confirmed by inspecting the published package;
// PR #893 only added `amd` to `voice.proto`'s `CreateSessionRequest`, not to `calls.proto`).
// This read is forward-compatible dead code until Fonoster exposes the field: `parseAmdStatus`
// always returns `undefined` today, so no `path` is ever set from this path yet.
type CallDetailRecordWithAmd = { amdStatus?: unknown };

/**
 * Reads the CDR's `amdStatus` (Fonoster's answering-machine detection verdict), treating
 * the wire the same way `status`/`endedAt` already are here: not trusted at the declared
 * type. `undefined` for anything unrecognized or absent (AMD wasn't enabled for the call)
 * — the sweep must never invent a verdict that wasn't actually reported.
 */
export function parseAmdStatus(value: unknown): AmdStatus | undefined {
  return typeof value === "string" && VALID_AMD_STATUSES.has(value as AmdStatus)
    ? (value as AmdStatus)
    : undefined;
}

let warnedUnparseableEndedAt = false;

/**
 * Loud, once per process: if a terminal CDR's `endedAt` cannot be parsed, the sweep's grace
 * period (which depends on it) can't be evaluated, so finalizing that gestión waits on the
 * backstop instead — minutes later than it should, and with the useful detail of *when* the
 * call ended lost even though the reason it failed is still known and used. That must
 * surface immediately, not as a quiet delay.
 */
function warnUnparseableEndedAt(rawValue: unknown): void {
  if (warnedUnparseableEndedAt) return;
  warnedUnparseableEndedAt = true;
  logger.warn(
    `voice completion sweep: a terminal CDR's endedAt could not be parsed ` +
      `(typeof=${typeof rawValue}, value=${JSON.stringify(rawValue)}). The sweep cannot apply ` +
      `its grace period without it and will wait for the backstop to finalize this gestión ` +
      `instead — this needs investigating.`
  );
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
   * Also surfaces the CDR's `amdStatus` (answering-machine detection verdict) when present —
   * see {@link parseAmdStatus}.
   */
  async getCall(ref: string): Promise<VoiceCallLookupResult> {
    try {
      const calls = await withTimeout(this.calls(), "login");
      const record = await withTimeout(calls.getCall(ref), "getCall");
      // The SDK's own CallStatus type omits UNKNOWN (the protobuf zero-value), so an
      // in-progress call's status can arrive as something outside that type at runtime.
      const status = (record.status as unknown as VoiceCallStatus) || "UNKNOWN";
      const endedAt = parseEndedAt(record.endedAt);
      // A terminal CDR is one that has genuinely cleared, so it should always carry a
      // parseable endedAt; UNKNOWN legitimately doesn't (the call hasn't cleared yet).
      if (status !== "UNKNOWN" && endedAt === null) {
        warnUnparseableEndedAt(record.endedAt);
      }
      const amdStatus = parseAmdStatus((record as unknown as CallDetailRecordWithAmd).amdStatus);
      return {
        found: true,
        status,
        setupToClearSeconds: record.duration ?? 0,
        endedAt,
        ...(amdStatus ? { amdStatus } : {})
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
