/**
 * Process-level safety net for stray promise rejections (issue #142).
 *
 * The Fonoster SDK's gRPC token-refresh interceptor
 * (`@fonoster/sdk` → `TokenRefresherNode.createInterceptor`) declares its
 * `sendMessage` hook `async` and awaits `refreshToken()`, but gRPC's
 * `InterceptingCall` invokes that hook synchronously and discards the returned
 * promise. When the identity service fails a refresh (observed in production:
 * `13 INTERNAL`), the rejection lands on a detached promise that no
 * application-level `try/catch` can reach — the `try/catch` in
 * `FonosterOutboundCallClient.createCall` wraps the outer call promise, not the
 * interceptor's floating one. Under Node 22 (`--unhandled-rejections=throw` by
 * default) that stray rejection becomes an uncaught exception and the apiserver
 * process dies mid-campaign.
 *
 * We are deliberately NOT patching `@fonoster/sdk` here (third-party, lives in
 * node_modules). Instead this installs a targeted `unhandledRejection` guard:
 *
 *   - If the rejection's stack points at the SDK's token-refresh interceptor we
 *     log loudly at error level (the error, its stack, and an explicit note
 *     that the process was kept alive) and let the process live. The affected
 *     gRPC call still fails and is classified by its caller; the engine carries
 *     on instead of crash-restarting into a race for the engine lease.
 *
 *   - Any other unhandled rejection is treated as a genuine (most likely
 *     application) bug: it is logged just as loudly and then the process exits,
 *     restoring Node's default fail-fast behavior so real bugs are never
 *     silently swallowed in dev, tests, or production.
 *
 * The allowlist is intentionally narrow and matched on stack strings. That is
 * fragile if the SDK renames files, but the failure mode of a missed match is
 * simply the pre-existing crash — never a masked bug — so the trade-off favors
 * the narrow match over a blunt "keep the process alive for every unhandled
 * rejection" handler.
 *
 * Scope: `unhandledRejection` only. `uncaughtException` is intentionally left
 * alone — a synchronous throw that reaches the top of the stack is almost
 * always our own bug and should keep crashing the process.
 *
 * Upstream: Fonoster #879, #880.
 */

/** Minimal logger surface used here (the repo's `@fonoster/logger` satisfies it). */
export interface GuardLogger {
  error(message: string, ...meta: unknown[]): void;
}

/**
 * Stack-trace fragments that identify a stray rejection escaping the Fonoster
 * SDK's gRPC token-refresh interceptor (issue #142). Broad enough to cover both
 * the Node and Web refresher variants.
 */
const SDK_INTERCEPTOR_STACK_MARKERS = [
  "TokenRefresherNode",
  "TokenRefresherWeb",
  "@fonoster/sdk/dist/node/client/TokenRefresher",
  "node_modules/@fonoster/sdk"
] as const;

/**
 * Frames proving the rejection leaked from the interceptor's floating promise
 * rather than from a properly-awaited SDK call that merely passes through the
 * refresher. The production stack in issue #142 shows all three
 * (`refreshToken` → `Object.sendMessage (TokenRefresherNode.js)` →
 * `InterceptingCall.sendMessageWithContext`).
 */
const SDK_INTERCEPTOR_LEAK_FRAMES = ["InterceptingCall", "sendMessage", "refreshToken"] as const;

/** True when `reason` looks like the known SDK interceptor stray rejection. */
export function isSdkInterceptorStrayRejection(reason: unknown): boolean {
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (typeof stack !== "string") return false;
  const fromInterceptorFile = SDK_INTERCEPTOR_STACK_MARKERS.some((m) => stack.includes(m));
  const fromLeakPath = SDK_INTERCEPTOR_LEAK_FRAMES.some((m) => stack.includes(m));
  return fromInterceptorFile && fromLeakPath;
}

function describe(reason: unknown): { message: string; stack: string } {
  if (reason instanceof Error) {
    return { message: reason.message, stack: reason.stack ?? "<no stack>" };
  }
  return { message: String(reason), stack: "<non-error rejection, no stack>" };
}

interface CreateHandlerDeps {
  logger: GuardLogger;
  /**
   * Invoked after logging a rejection that is NOT on the allowlist. Defaults to
   * exiting the process (Node's fail-fast default). Injectable so tests can
   * assert it fires without tearing down the test runner.
   */
  onUnrecognizedRejection?: () => void;
}

/**
 * Builds the `unhandledRejection` listener. Kept separate from
 * {@link installProcessGuards} so it can be unit-tested without touching the
 * real `process` object.
 */
export function createUnhandledRejectionHandler(deps: CreateHandlerDeps) {
  const { logger, onUnrecognizedRejection = () => process.exit(1) } = deps;

  return function handleUnhandledRejection(reason: unknown): void {
    const { message, stack } = describe(reason);

    if (isSdkInterceptorStrayRejection(reason)) {
      logger.error(
        "[processGuards] stray unhandled rejection from the Fonoster SDK token-refresh " +
          "interceptor — process kept alive (issue #142). The affected gRPC call has " +
          "already failed; its caller classifies the failure and the engine continues.",
        { err: message, stack, keptAlive: true, source: "fonoster-sdk-token-refresher" }
      );
      return;
    }

    logger.error(
      "[processGuards] unrecognized unhandled promise rejection — treated as a real bug; " +
        "the process will now exit (issue #142). If this is another third-party stray " +
        "rejection, add its signature to SDK_INTERCEPTOR_STACK_MARKERS.",
      { err: message, stack, keptAlive: false }
    );
    onUnrecognizedRejection();
  };
}

/**
 * Registers the process-level guards. Call once, as early as possible in the
 * apiserver bootstrap.
 */
export function installProcessGuards(deps: CreateHandlerDeps): void {
  process.on("unhandledRejection", createUnhandledRejectionHandler(deps));
}
