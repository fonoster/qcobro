import * as grpc from "@grpc/grpc-js";
import { buildIdentityService } from "@fonoster/identity";
import { createServiceDefinition } from "@fonoster/common";
import { identityConfig, identityPort } from "./config.js";

async function main() {
  const bindAddr = `0.0.0.0:${identityPort}`;

  const { definition, handlers } = buildIdentityService(identityConfig);

  const server = new grpc.Server();
  server.addService(
    createServiceDefinition(definition),
    handlers as unknown as grpc.UntypedServiceImplementation
  );

  // Use our own grpc-js instance for credentials so the Server's instanceof
  // check passes (@fonoster/common bundles a separate grpc-js copy). The
  // service runs on a private network; TLS is a deployment concern.
  const credentials = grpc.ServerCredentials.createInsecure();

  server.bindAsync(bindAddr, credentials, (error, boundPort) => {
    if (error) {
      console.error("Failed to start Identity service:", error);
      process.exit(1);
    }
    console.log(`Identity service listening on 0.0.0.0:${boundPort}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
