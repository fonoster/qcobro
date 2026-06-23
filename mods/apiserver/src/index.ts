import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/index.js";
import { createContext } from "./trpc/context.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { createContactLogHandler } from "./rest/contactLogs.js";
import { createVoiceEventsHandler } from "./rest/voiceEvents.js";
import { startVoiceServer } from "./voice/voiceServer.js";

const app = express();
const port = config.apiserver.port;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// External contact-log ingress (e.g. Fonoster voice callbacks). Workspace-scoped
// HTTP Basic auth, gated by config; shares hot-path updates with the tRPC path.
app.post("/api/contact-logs", createContactLogHandler(prisma, config));

// Fonoster autopilot events-hook for Voz IA calls (conversation.started / .ended).
// FIXME(security): UNAUTHENTICATED — must be secured very soon (see handler note).
app.post("/api/voice/events", createVoiceEventsHandler(prisma as never));

// Internal API. A future change can mount a public REST/OpenAPI router on a
// separate path (e.g. /api) alongside this one.
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// External voice application for pre-recorded agents (own port).
startVoiceServer();
