import { useEffect, useState } from "react";
import { authHeaders } from "./trpc.js";

/**
 * Fetches a gestión's recording from the apiserver with the caller's credentials and returns
 * a blob URL for `<audio src>`, which can't send headers itself. `failed` is true when the
 * recording couldn't be loaded. The blob URL is revoked when the path changes or the
 * component unmounts.
 */
export function useRecordingBlobUrl(path: string | null | undefined): {
  src: string | undefined;
  failed: boolean;
} {
  const [state, setState] = useState<{ src: string | undefined; failed: boolean }>({
    src: undefined,
    failed: false
  });

  useEffect(() => {
    if (!path) {
      setState({ src: undefined, failed: false });
      return;
    }
    let objectUrl: string | undefined;
    let cancelled = false;
    setState({ src: undefined, failed: false });
    fetch(path, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(`recording request failed: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: undefined, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return state;
}
