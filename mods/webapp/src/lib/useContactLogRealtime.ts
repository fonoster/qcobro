import { useCallback } from "react";
import { trpc } from "./trpc.js";

/**
 * Realtime-streaming capability: keeps the Gestiones list and Gestión detail queries live.
 * Subscribes to `campaigns.contactLog.onChange` (a WebSocket subscription that streams only
 * `{ id }` change signals, never row data) and invalidates the matching query on each one —
 * the existing `campaigns.contactLog.list`/`.get` fetch is the single source of truth for
 * what renders, this hook only decides when to refetch it.
 *
 * This is also the fallback story: if the WebSocket transport can't connect, the
 * subscription simply never emits and the screen behaves exactly as it does today
 * (fetch on mount/navigation) — no error is surfaced to the operator for that alone.
 *
 * @param id Omit for the Gestiones list (any change in the active workspace is relevant).
 *   Pass a gestión id to scope to the Gestión detail view for that one gestión.
 */
export function useContactLogRealtime(id?: string): void {
  const utils = trpc.useUtils();

  // Stable across re-renders (only changes when `id`/`utils` actually change) so the
  // underlying WS subscription isn't torn down and reopened on every unrelated render of
  // the component using this hook.
  const onData = useCallback(() => {
    if (id) {
      void utils.campaigns.contactLog.get.invalidate({ id });
    } else {
      void utils.campaigns.contactLog.list.invalidate();
    }
  }, [id, utils]);

  // Swallow subscription errors (e.g. WS unavailable) — the query/refetch fallback keeps
  // the screen correct either way, so this must never surface as a UI error.
  const onError = useCallback(() => {}, []);

  trpc.campaigns.contactLog.onChange.useSubscription({ id }, { onData, onError });
}
