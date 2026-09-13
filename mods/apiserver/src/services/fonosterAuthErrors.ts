/** The Fonoster SDK's gRPC client throws `ServiceError`s carrying a numeric `.code` (grpc.status). */
export interface GrpcServiceError {
  code?: number;
  message?: string;
}

export function isGrpcServiceError(err: unknown): err is GrpcServiceError {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "number";
}

/**
 * True when a post-login RPC failed because the session's access token is no longer good —
 * either Fonoster rejected it outright (`UNAUTHENTICATED`) or its own token-refresh attempt
 * failed server-side, which Fonoster surfaces as `UNAVAILABLE` with this specific message
 * rather than `UNAUTHENTICATED`. Shared by every Fonoster-backed client here
 * (`FonosterOutboundCallClient`, `FonosterVoiceApplicationClient`): each memoizes its login
 * once it succeeds, so nothing else would ever notice the underlying token had gone bad —
 * every later call would keep reusing the same wedged client for the life of the process
 * without this driving each client's own invalidate-on-auth-failure logic.
 */
export function isAuthTokenFailure(err: unknown): boolean {
  if (!isGrpcServiceError(err)) return false;
  if (err.code === 16 /* UNAUTHENTICATED */) return true;
  return (
    err.code === 14 /* UNAVAILABLE */ &&
    typeof err.message === "string" &&
    /refresh the access token/i.test(err.message)
  );
}
