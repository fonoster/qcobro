import * as grpc from "@grpc/grpc-js";
import type { FonosterFake } from "./fake.js";
import {
  ApplicationsService,
  ApplicationType,
  CallDetailRecord,
  CallDirection,
  CallsService,
  CallStatus,
  CallType,
  CreateApplicationResponse,
  CreateCallResponse,
  DeleteApplicationResponse,
  ExchangeApiKeyResponse,
  ExchangeRefreshTokenResponse,
  IdentityService,
  UpdateApplicationResponse,
  type Message
} from "./proto.js";
import type { Tokens } from "./tokens.js";

const E164 = /^\+[1-9]\d{1,14}$/;
const SIP_URI = /^sips?:\S+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_RING_TIMEOUT = 30;
const MAX_RING_TIMEOUT = 120;

const CDR_STATUS = {
  answered: "NORMAL_CLEARING",
  busy: "USER_BUSY",
  no_answer: "NO_ANSWER",
  rejected: "CALL_REJECTED"
} as const;

type Callback = (error: Partial<grpc.ServiceError> | null, response?: Message) => void;
type UnaryCall = { request: Message; metadata: grpc.Metadata };
type Handler = (call: UnaryCall, callback: Callback) => void;

class RpcError extends Error {
  constructor(
    readonly code: grpc.status,
    message: string
  ) {
    super(message);
  }
}

/** Runs a handler, turning a thrown {@link RpcError} into that gRPC status. */
function unary(fn: (call: UnaryCall) => Message): Handler {
  return (call, callback) => {
    try {
      callback(null, fn(call));
    } catch (err) {
      if (err instanceof RpcError) callback({ code: err.code, details: err.message });
      else callback({ code: grpc.status.INTERNAL, details: String(err) });
    }
  };
}

const enumName = (values: Record<string, number>, value: number) =>
  Object.keys(values).find((k) => values[k] === value) ?? String(value);

/** An application request as JSON: the enum by name and every Struct as a plain object. */
function applicationJson(request: Message): Record<string, unknown> {
  const { listenersList, ...rest } = request.toObject();
  delete rest.ref;
  delete rest.filtersList;
  const intelligence = request.getIntelligence();
  return {
    ...rest,
    type: enumName(ApplicationType, request.getType()),
    intelligence: intelligence
      ? {
          productRef: intelligence.getProductRef(),
          config: intelligence.getConfig()?.toJavaScript() ?? {}
        }
      : undefined,
    listeners: listenersList,
    filters: request.getFiltersList().map((f: Message) => ({
      name: f.getName(),
      ...(f.getOptions() ? { options: f.getOptions().toJavaScript() } : {})
    }))
  };
}

/**
 * The Identity, Applications and Calls services, as the real `@fonoster/sdk` 0.63.0 calls them.
 * Every method not implemented here answers UNIMPLEMENTED (grpc-js's default), including
 * `TrackCall` and `EvaluateIntelligence`.
 */
export function createGrpcServer(fake: FonosterFake, tokens: Tokens): grpc.Server {
  const { config } = fake;

  /** The caller's access key, after checking its token; UNAUTHENTICATED otherwise. */
  const authenticate = (metadata: grpc.Metadata): string => {
    const token = metadata.get("token")[0]?.toString();
    const accessKeyId = metadata.get("accesskeyid")[0]?.toString();
    if (!tokens.verify(token, "access") || accessKeyId !== config.accessKeyId)
      throw new RpcError(grpc.status.UNAUTHENTICATED, "invalid or expired access token");
    return accessKeyId;
  };

  /** AUTOPILOT apps must name a language model from the catalog (`<provider>/<model>`). */
  const checkLanguageModel = (request: Message) => {
    if (request.getType() !== ApplicationType.AUTOPILOT) return;
    const config = request.getIntelligence()?.getConfig()?.toJavaScript() as
      | { languageModel?: { model?: unknown } }
      | undefined;
    const model = config?.languageModel?.model;
    if (typeof model !== "string" || !fake.config.llmModels.includes(model))
      throw new RpcError(
        grpc.status.INVALID_ARGUMENT,
        `language model ${String(model)} is not in the catalog (${fake.config.llmModels.join(", ")})`
      );
  };

  const server = new grpc.Server();

  server.addService(IdentityService, {
    exchangeApiKey: unary(({ request }) => {
      if (
        request.getAccessKeyId() !== config.apiKey ||
        request.getAccessKeySecret() !== config.apiSecret
      )
        throw new RpcError(grpc.status.UNAUTHENTICATED, "invalid API key or secret");
      const { accessToken, refreshToken } = tokens.session();
      const response = new ExchangeApiKeyResponse();
      response.setAccessToken(accessToken);
      response.setRefreshToken(refreshToken);
      return response;
    }),
    exchangeRefreshToken: unary(({ request }) => {
      if (!tokens.verify(request.getRefreshToken(), "refresh"))
        throw new RpcError(grpc.status.UNAUTHENTICATED, "invalid or expired refresh token");
      const session = tokens.session();
      const response = new ExchangeRefreshTokenResponse();
      response.setAccessToken(session.accessToken);
      response.setRefreshToken(session.refreshToken);
      response.setIdToken(session.idToken);
      return response;
    })
  } as unknown as grpc.UntypedServiceImplementation);

  server.addService(ApplicationsService, {
    createApplication: unary(({ request, metadata }) => {
      const accessKeyId = authenticate(metadata);
      checkLanguageModel(request);
      const app = fake.createApplication(accessKeyId, applicationJson(request));
      const response = new CreateApplicationResponse();
      response.setRef(app.ref);
      return response;
    }),
    updateApplication: unary(({ request, metadata }) => {
      const accessKeyId = authenticate(metadata);
      const app = fake.application(accessKeyId, request.getRef());
      if (!app)
        throw new RpcError(grpc.status.NOT_FOUND, `application ${request.getRef()} not found`);
      checkLanguageModel(request);
      app.request = applicationJson(request);
      const response = new UpdateApplicationResponse();
      response.setRef(app.ref);
      return response;
    }),
    deleteApplication: unary(({ request, metadata }) => {
      const accessKeyId = authenticate(metadata);
      const app = fake.application(accessKeyId, request.getRef());
      if (!app)
        throw new RpcError(grpc.status.NOT_FOUND, `application ${request.getRef()} not found`);
      fake.applications.delete(app.ref);
      const response = new DeleteApplicationResponse();
      response.setRef(app.ref);
      return response;
    })
  } as unknown as grpc.UntypedServiceImplementation);

  server.addService(CallsService, {
    createCall: unary(({ request, metadata }) => {
      const accessKeyId = authenticate(metadata);
      const from: string = request.getFrom();
      const to: string = request.getTo();
      const appRef: string = request.getAppRef();
      const timeout: number = request.getTimeout() || DEFAULT_RING_TIMEOUT;
      const invalid = (message: string) => new RpcError(grpc.status.INVALID_ARGUMENT, message);
      if (!E164.test(from)) throw invalid(`from ${from} is not an E.164 number`);
      if (!E164.test(to) && !SIP_URI.test(to))
        throw invalid(`to ${to} is not an E.164 number or SIP URI`);
      if (!UUID.test(appRef)) throw invalid(`appRef ${appRef} is not a UUID`);
      if (timeout > MAX_RING_TIMEOUT)
        throw invalid(`timeout ${timeout} is over ${MAX_RING_TIMEOUT} seconds`);
      if (!fake.application(accessKeyId, appRef))
        throw new RpcError(grpc.status.NOT_FOUND, `application ${appRef} not found`);
      if (!config.numbers.includes(from))
        throw new RpcError(
          grpc.status.PERMISSION_DENIED,
          `${from} is not a number of this workspace`
        );
      const call = fake.createCall({
        accessKeyId,
        from,
        to,
        appRef,
        timeout,
        metadata: (request.getMetadata()?.toJavaScript() as Record<string, unknown>) ?? {}
      });
      const response = new CreateCallResponse();
      response.setRef(call.ref);
      return response;
    }),
    getCall: unary(({ request, metadata }) => {
      const accessKeyId = authenticate(metadata);
      const ref: string = request.getRef();
      if (!UUID.test(ref))
        throw new RpcError(grpc.status.INVALID_ARGUMENT, `ref ${ref} is not a UUID`);
      const call = fake.calls.get(ref);
      if (!call || call.accessKeyId !== accessKeyId || !call.sealed)
        throw new RpcError(grpc.status.NOT_FOUND, `call ${ref} not found`);
      const endedAt = Math.floor((call.endedAt ?? new Date()).getTime() / 1000);
      const cdr = new CallDetailRecord();
      cdr.setRef(call.ref);
      cdr.setType(CallType.API_ORIGINATED);
      cdr.setStatus(CallStatus[CDR_STATUS[call.outcome]]);
      cdr.setStartedAt(endedAt - call.durationSeconds);
      cdr.setEndedAt(endedAt);
      cdr.setFrom(call.from);
      cdr.setTo(call.to);
      cdr.setDuration(call.durationSeconds);
      cdr.setDirection(CallDirection.TO_PSTN);
      cdr.setAppRef(call.appRef);
      return cdr;
    })
  } as unknown as grpc.UntypedServiceImplementation);

  return server;
}

/** Binds the server with TLS on `port` (0 picks a free one); resolves with the bound port. */
export function bindGrpc(
  server: grpc.Server,
  port: number,
  tls: { cert: Buffer; key: Buffer }
): Promise<number> {
  const credentials = grpc.ServerCredentials.createSsl(
    null,
    [{ cert_chain: tls.cert, private_key: tls.key }],
    false
  );
  return new Promise((resolve, reject) =>
    server.bindAsync(`0.0.0.0:${port}`, credentials, (err, bound) =>
      err ? reject(err) : resolve(bound)
    )
  );
}
