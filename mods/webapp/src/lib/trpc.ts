import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@qcobro/apiserver";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } }
});

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const ID_TOKEN_KEY = "idToken";
export const WORKSPACE_KEY = "workspace";

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
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
  ]
});
