import { readFileSync } from "node:fs";
import type { Server } from "node:net";
import type { AddressInfo } from "node:net";
import type { FonosterFakeConfig } from "./config.js";
import { createControlServer } from "./control.js";
import { FonosterFake } from "./fake.js";
import { bindGrpc, createGrpcServer } from "./grpc.js";
import { createRecordsServer } from "./records.js";
import { Tokens } from "./tokens.js";

export interface RunningFonosterFake {
  fake: FonosterFake;
  grpcPort: number;
  httpsPort: number;
  controlPort: number;
  /** `http://localhost:<controlPort>`, for the control API. */
  controlUrl: string;
  stop(): Promise<void>;
}

const listen = (server: Server, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve((server.address() as AddressInfo).port));
  });

const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

/** Starts the gRPC (TLS), records (HTTPS) and control (HTTP) servers in this process. */
export async function startFonosterFake(config: FonosterFakeConfig): Promise<RunningFonosterFake> {
  const tls = { cert: readFileSync(config.tlsCert), key: readFileSync(config.tlsKey) };
  const fake = new FonosterFake(config);
  const tokens = new Tokens(config.accessKeyId);

  const grpcServer = createGrpcServer(fake, tokens);
  const records = createRecordsServer(fake, tokens, tls);
  const control = createControlServer(fake);

  const grpcPort = await bindGrpc(grpcServer, config.grpcPort, tls);
  const httpsPort = await listen(records, config.httpsPort);
  const controlPort = await listen(control, config.controlPort);

  return {
    fake,
    grpcPort,
    httpsPort,
    controlPort,
    controlUrl: `http://localhost:${controlPort}`,
    async stop() {
      fake.stop();
      grpcServer.forceShutdown();
      records.closeAllConnections();
      control.closeAllConnections();
      await Promise.all([close(records), close(control)]);
    }
  };
}
