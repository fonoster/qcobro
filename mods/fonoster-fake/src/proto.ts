/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequire } from "node:module";

/**
 * The gRPC service definitions and messages the real `@fonoster/sdk` was generated with. They
 * ship as untyped CommonJS, so they are loaded here once, loosely typed, and nothing is vendored.
 */
const require = createRequire(import.meta.url);
const generated = (name: string) => require(`@fonoster/sdk/dist/node/generated/node/${name}`);

/** A google-protobuf message instance (getters, setters, `toObject`). */
export type Message = Record<string, any>;
type MessageClass = new () => Message;

const identityGrpc = generated("identity_grpc_pb.js");
const applicationsGrpc = generated("applications_grpc_pb.js");
const callsGrpc = generated("calls_grpc_pb.js");
const identityPb = generated("identity_pb.js");
const applicationsPb = generated("applications_pb.js");
const callsPb = generated("calls_pb.js");

export const IdentityService = identityGrpc.IdentityService;
export const ApplicationsService = applicationsGrpc.ApplicationsService;
export const CallsService = callsGrpc.CallsService;

export const ExchangeApiKeyResponse: MessageClass = identityPb.ExchangeApiKeyResponse;
export const ExchangeRefreshTokenResponse: MessageClass = identityPb.ExchangeRefreshTokenResponse;
export const CreateApplicationResponse: MessageClass = applicationsPb.CreateApplicationResponse;
export const UpdateApplicationResponse: MessageClass = applicationsPb.UpdateApplicationResponse;
export const DeleteApplicationResponse: MessageClass = applicationsPb.DeleteApplicationResponse;
export const CreateCallResponse: MessageClass = callsPb.CreateCallResponse;
export const CallDetailRecord: MessageClass = callsPb.CallDetailRecord;

export const ApplicationType: Record<string, number> = applicationsPb.ApplicationType;
export const CallStatus: Record<string, number> = callsPb.CallStatus;
export const CallType: Record<string, number> = callsPb.CallType;
export const CallDirection: Record<string, number> = callsPb.CallDirection;
