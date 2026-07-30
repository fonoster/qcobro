import { createTRPCReact } from "@trpc/react-query";
import { createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@qcobro/apiserver";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  // staleTime 0 so navigating to a page refetches its lists — otherwise a list cached
  // (often empty) by the dashboard is reused for up to its stale window and misses rows
  // created since (incl. out-of-band writes). retry off keeps failures fast/visible.
  defaultOptions: { queries: { staleTime: 0, retry: false } }
});

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const ID_TOKEN_KEY = "idToken";
export const WORKSPACE_KEY = "workspace";

// Realtime-streaming capability (Gestiones list / Gestión detail): a WebSocket client used
// only for `subscription`-type operations (see splitLink below). `connectionParams` carries
// the same auth the HTTP link sends as headers — browsers can't set custom headers on a
// WebSocket handshake, so tRPC sends this as the connection's first message instead; the
// server reads it in `createWSContext`. `lazy` keeps the socket closed whenever neither
// screen has an active subscription, so opening it always picks up the current token/
// workspace and nothing is held open app-wide.
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsClient = createWSClient({
  url: () => `${wsProtocol}//${window.location.host}/trpc-ws`,
  connectionParams: () => ({
    token: localStorage.getItem(ACCESS_TOKEN_KEY) ?? "",
    workspace: localStorage.getItem(WORKSPACE_KEY) ?? ""
  }),
  lazy: { enabled: true, closeMs: 0 }
});

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: "/trpc",
        headers() {
          const headers: Record<string, string> = {};
          const token = localStorage.getItem(ACCESS_TOKEN_KEY);
          const workspace = localStorage.getItem(WORKSPACE_KEY);
          if (token) headers.Authorization = `Bearer ${token}`;
          if (workspace) headers["x-workspace"] = workspace;
          return headers;
        }
      })
    })
  ]
});
