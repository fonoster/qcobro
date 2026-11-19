#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { startFonosterFake } from "./server.js";

/** `qcobro-fonoster-fake`: the fake as one process, configured from `FONOSTER_FAKE_*`. */
try {
  const running = await startFonosterFake(loadConfig());
  console.log(
    `fonoster-fake: gRPC (TLS) on :${running.grpcPort}, records (HTTPS) on :${running.httpsPort}, ` +
      `control on :${running.controlPort}`
  );
  const shutdown = () => void running.stop().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (err) {
  console.error(`fonoster-fake: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
