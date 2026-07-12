/**
 * Shared HTTP Basic-auth header parsing for the REST handlers. One decode path
 * (scheme check, base64, first-colon split) so hardening applies everywhere;
 * each caller decides what its username/password mean and which may be empty.
 */
export function parseBasicAuth(
  authHeader: string | undefined
): { username: string; password: string } | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep <= 0) return null;
  return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}
