import jwt from "jsonwebtoken";
import type { IdentityClient } from "./client.js";

export interface WorkspaceAccess {
  accessKeyId: string;
  role: string;
}

export interface AccessClaims {
  /** User ref (JWT subject). */
  sub: string;
  /** The user's own access key id (US...). */
  accessKeyId: string;
  /** Workspaces the user can act in, with their role. */
  access: WorkspaceAccess[];
}

let cachedPublicKey: string | null = null;

async function getPublicKey(identity: IdentityClient): Promise<string> {
  if (!cachedPublicKey) {
    const { publicKey } = await identity.getPublicKey();
    cachedPublicKey = publicKey;
  }
  return cachedPublicKey;
}

/**
 * Verifies an Identity-issued RS256 access token using Identity's public key
 * (fetched once and cached). Returns the claims, or null when the token is
 * missing, malformed, expired, or otherwise invalid.
 */
export async function verifyAccessToken(
  identity: IdentityClient,
  token: string
): Promise<AccessClaims | null> {
  try {
    const publicKey = await getPublicKey(identity);
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    if (typeof decoded === "string") {
      return null;
    }
    const claims = decoded as jwt.JwtPayload & {
      accessKeyId?: string;
      access?: WorkspaceAccess[];
    };
    if (!claims.sub || !claims.accessKeyId) {
      return null;
    }
    return {
      sub: claims.sub,
      accessKeyId: claims.accessKeyId,
      access: claims.access ?? []
    };
  } catch {
    return null;
  }
}
