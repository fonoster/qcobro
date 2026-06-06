import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@qcobro/apiserver";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } }
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      headers() {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
      }
    })
  ]
});
