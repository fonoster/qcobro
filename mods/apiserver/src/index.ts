import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/index.js";
import { createContext } from "./trpc/context.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);

// Serve compiled webapp in production
if (process.env.NODE_ENV === "production") {
  const { default: path } = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webappDist = path.join(__dirname, "../../webapp/dist");
  app.use(express.static(webappDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webappDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
