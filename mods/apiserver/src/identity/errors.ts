import { status } from "@grpc/grpc-js";
import { TRPCError } from "@trpc/server";

type TRPCErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "TOO_MANY_REQUESTS"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_SERVER_ERROR";

interface GrpcLikeError {
  code?: number;
  details?: string;
  message?: string;
}

const STATUS_TO_TRPC: Partial<Record<number, TRPCErrorCode>> = {
  [status.INVALID_ARGUMENT]: "BAD_REQUEST",
  [status.UNAUTHENTICATED]: "UNAUTHORIZED",
  [status.PERMISSION_DENIED]: "UNAUTHORIZED",
  [status.NOT_FOUND]: "NOT_FOUND",
  [status.ALREADY_EXISTS]: "CONFLICT",
  [status.FAILED_PRECONDITION]: "PRECONDITION_FAILED",
  [status.RESOURCE_EXHAUSTED]: "TOO_MANY_REQUESTS",
  [status.UNIMPLEMENTED]: "NOT_IMPLEMENTED"
};

/**
 * Maps a gRPC error from the Identity service to a typed `TRPCError` so clients
 * can distinguish categories (e.g. invalid credentials -> UNAUTHORIZED).
 */
export function toTRPCError(error: unknown): TRPCError {
  const grpcError = error as GrpcLikeError;
  const code = typeof grpcError.code === "number" ? STATUS_TO_TRPC[grpcError.code] : undefined;
  return new TRPCError({
    code: code ?? "INTERNAL_SERVER_ERROR",
    message: grpcError.details ?? grpcError.message ?? "Identity service error",
    cause: error
  });
}

/** Runs an Identity call, converting any gRPC error into a `TRPCError`. */
export async function identityCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toTRPCError(error);
  }
}
