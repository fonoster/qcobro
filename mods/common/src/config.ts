import { z } from "zod";

/**
 * QCobro service configuration — the shape of `qcobro.json`.
 *
 * This module exports the schema/type only (no filesystem access) so it stays
 * safe to import from the browser. Server packages load the file and call
 * `qcobroConfigSchema.parse(...)`.
 *
 * Identity runs as an external Fonoster Identity service; QCobro only needs the
 * endpoint to reach it. All Identity service configuration (database, keys,
 * issuer, SMTP, …) lives with that service, not here.
 */
export const identityConfigSchema = z.object({
  /** host:port the apiserver uses to reach the external Identity gRPC service. */
  endpoint: z.string().default("localhost:50051"),
  /** Base URL of the Identity HTTP bridge (accepts invite tokens). */
  httpBridgeUrl: z.string().default("http://localhost:9110")
});

export const qcobroConfigSchema = z.object({
  /** Application (apiserver) database. */
  database: z.object({ url: z.string().min(1) }),
  identity: identityConfigSchema,
  apiserver: z
    .object({
      port: z.number().default(3000),
      /**
       * Deployment-wide IANA timezone for interpreting campaign wall-clock
       * outreach windows (`startTime`/`endTime`). Per-workspace zones deferred.
       */
      timezone: z.string().default("America/Costa_Rica"),
      /** External contact-log ingress (`POST /api/contact-logs`) auth gate. */
      contactLogAuth: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false })
    })
    .default({ port: 3000, timezone: "America/Costa_Rica", contactLogAuth: { enabled: false } })
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
export type QCobroConfig = z.infer<typeof qcobroConfigSchema>;
