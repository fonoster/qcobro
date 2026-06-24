/**
 * Role the caller holds in a given workspace, read from the access-token claims.
 *
 * Identity issues an access token whose `access` claim lists each workspace the
 * user can act in (by accessKeyId) and their role there. We decode the JWT
 * payload locally — this is for UI gating only; the apiserver re-enforces every
 * privileged action via adminProcedure/ownerProcedure.
 */
export function activeRole(accessToken: string | null, accessKeyId: string | null): string | null {
  if (!accessToken || !accessKeyId) return null;
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { access?: { accessKeyId: string; role: string }[] };
    return claims.access?.find((a) => a.accessKeyId === accessKeyId)?.role ?? null;
  } catch {
    return null;
  }
}

/** True when the caller is a workspace owner or admin of the given workspace. */
export function isWorkspaceAdmin(accessToken: string | null, accessKeyId: string | null): boolean {
  const role = activeRole(accessToken, accessKeyId);
  return role === "WORKSPACE_OWNER" || role === "WORKSPACE_ADMIN";
}
