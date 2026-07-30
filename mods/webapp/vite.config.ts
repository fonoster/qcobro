import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  server: {
    proxy: {
      "/trpc": "http://localhost:3000",
      // WebSocket transport for tRPC subscriptions (realtime-streaming capability),
      // separate from the /trpc HTTP batch mount above.
      "/trpc-ws": { target: "ws://localhost:3000", ws: true },
      "/api": "http://localhost:3000"
    }
  }
});
