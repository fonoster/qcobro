import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createUnhandledRejectionHandler,
  isSdkInterceptorStrayRejection,
  type GuardLogger
} from "./processGuards.js";

/**
 * The production stack from issue #142: a `13 INTERNAL` from the identity service
 * escaping the SDK's token-refresh interceptor as a floating-promise rejection.
 */
function makeInterceptorStrayRejection(): Error {
  const err = new Error("13 INTERNAL: Internal server error");
  err.stack = [
    "Error: 13 INTERNAL: Internal server error",
    "    at ServiceClientImpl.exchangeRefreshToken (/app/node_modules/@fonoster/identity-client/dist/client.js:120:19)",
    "    at Client.loginWithRefreshToken (/app/node_modules/@fonoster/sdk/dist/node/client/AbstractClient.js:40:23)",
    "    at Client.refreshToken (/app/node_modules/@fonoster/sdk/dist/node/client/AbstractClient.js:105:17)",
    "    at Object.sendMessage (/app/node_modules/@fonoster/sdk/dist/node/client/TokenRefresherNode.js:35:32)",
    "    at InterceptingCall.sendMessageWithContext (/app/node_modules/@grpc/grpc-js/build/src/client-interceptors.js:406:19)"
  ].join("\n");
  return err;
}

/** An ordinary application error — nothing to do with the SDK interceptor. */
function makeAppError(): Error {
  const err = new Error("Cannot read properties of undefined (reading 'id')");
  err.stack = [
    "TypeError: Cannot read properties of undefined (reading 'id')",
    "    at recordOutcome (/app/mods/apiserver/src/functions/campaigns/recordOutcome.ts:42:18)",
    "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)"
  ].join("\n");
  return err;
}

/**
 * A properly-awaited SDK call that failed: its stack passes through
 * `@fonoster/sdk` but not the interceptor's floating-promise leak path, so it is
 * NOT the issue #142 case and must not get the keep-alive treatment.
 */
function makeAwaitedSdkError(): Error {
  const err = new Error("14 UNAVAILABLE: connection refused");
  err.stack = [
    "Error: 14 UNAVAILABLE: connection refused",
    "    at Calls.createCall (/app/node_modules/@fonoster/sdk/dist/node/calls/Calls.js:88:15)",
    "    at FonosterOutboundCallClient.createCall (/app/mods/apiserver/src/services/fonosterOutboundCallClient.ts:210:29)"
  ].join("\n");
  return err;
}

interface LoggedError {
  message: string;
  meta: unknown[];
}

function makeLogger(): GuardLogger & { errors: LoggedError[] } {
  const errors: LoggedError[] = [];
  return {
    errors,
    error(message: string, ...meta: unknown[]) {
      errors.push({ message, meta });
    }
  };
}

describe("isSdkInterceptorStrayRejection", () => {
  it("matches the issue #142 token-refresh interceptor stack", () => {
    assert.equal(isSdkInterceptorStrayRejection(makeInterceptorStrayRejection()), true);
  });

  it("does not match an ordinary application error", () => {
    assert.equal(isSdkInterceptorStrayRejection(makeAppError()), false);
  });

  it("does not match a properly-awaited SDK error (no interceptor leak frames)", () => {
    assert.equal(isSdkInterceptorStrayRejection(makeAwaitedSdkError()), false);
  });

  it("does not match a non-Error rejection value", () => {
    assert.equal(isSdkInterceptorStrayRejection("13 INTERNAL"), false);
    assert.equal(isSdkInterceptorStrayRejection(undefined), false);
    assert.equal(isSdkInterceptorStrayRejection({ message: "TokenRefresherNode" }), false);
  });
});

describe("createUnhandledRejectionHandler", () => {
  it("logs loudly and keeps the process alive for the SDK interceptor stray rejection", () => {
    const logger = makeLogger();
    let exited = 0;
    const handle = createUnhandledRejectionHandler({
      logger,
      onUnrecognizedRejection: () => {
        exited++;
      }
    });

    handle(makeInterceptorStrayRejection());

    assert.equal(exited, 0, "the process must NOT be torn down for this class of rejection");
    assert.equal(logger.errors.length, 1);
    const [entry] = logger.errors;
    assert.match(entry.message, /kept alive/i);
    assert.match(entry.message, /#142/);
    assert.deepEqual(entry.meta[0], {
      err: "13 INTERNAL: Internal server error",
      stack: makeInterceptorStrayRejection().stack,
      keptAlive: true,
      source: "fonoster-sdk-token-refresher"
    });
  });

  it("logs loudly and exits for an unrecognized rejection (a real bug is not masked)", () => {
    const logger = makeLogger();
    let exited = 0;
    const handle = createUnhandledRejectionHandler({
      logger,
      onUnrecognizedRejection: () => {
        exited++;
      }
    });

    handle(makeAppError());

    assert.equal(exited, 1, "an unknown rejection still fails fast");
    assert.equal(logger.errors.length, 1);
    const [entry] = logger.errors;
    assert.match(entry.message, /unrecognized/i);
    const meta = entry.meta[0] as { keptAlive: boolean };
    assert.equal(meta.keptAlive, false);
  });

  it("treats a non-Error rejection as unrecognized and exits, still logging it", () => {
    const logger = makeLogger();
    let exited = 0;
    const handle = createUnhandledRejectionHandler({
      logger,
      onUnrecognizedRejection: () => {
        exited++;
      }
    });

    handle("boom");

    assert.equal(exited, 1);
    assert.equal(logger.errors.length, 1);
    const meta = logger.errors[0].meta[0] as { err: string; keptAlive: boolean };
    assert.equal(meta.err, "boom");
    assert.equal(meta.keptAlive, false);
  });
});
