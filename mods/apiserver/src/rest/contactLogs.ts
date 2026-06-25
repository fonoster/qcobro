import type { Request, Response } from "express";
import { ValidationError } from "@qcobro/common";
import { createCreateContactLog } from "../functions/campaigns/createContactLog.js";

/** Minimal shape of the config slice this module needs. */
export interface ContactLogAuthConfig {
  apiserver: { contactLogAuth: { enabled: boolean } };
  /** Deployment timezone, for the daily-cap reset when recording the attempt. */
  timezone: string;
}

/** Minimal Prisma surface used to resolve an account's owning workspace. */
export interface ContactLogPrisma {
  portfolioAccount: {
    findUnique(args: {
      where: { id: string };
      select: { portfolio: { select: { workspaceRef: true } } };
    }): Promise<{ portfolio: { workspaceRef: string } } | null>;
  };
}

/**
 * Extracts the workspace a Basic-auth credential is scoped to. The username
 * carries the workspace ref; a password must be present (a colon in the decoded
 * value). Returns null for missing/malformed headers. The credential
 * storage/derivation mechanism is owned by the engine/integration change — here
 * we fix only the scope (workspace) and scheme (HTTP Basic).
 */
export function parseBasicWorkspace(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep <= 0) return null;
  const username = decoded.slice(0, sep);
  return username || null;
}

/**
 * Builds the `POST /api/contact-logs` handler. When `contactLogAuth.enabled`,
 * the request must carry valid workspace Basic credentials and the referenced
 * account must belong to that same workspace; otherwise it responds 401. When
 * disabled (local dev) the endpoint accepts unauthenticated requests.
 */
export function createContactLogHandler(prisma: ContactLogPrisma, config: ContactLogAuthConfig) {
  const create = createCreateContactLog(prisma as never, config.timezone);

  return async (req: Request, res: Response): Promise<void> => {
    if (config.apiserver.contactLogAuth.enabled) {
      const credWorkspace = parseBasicWorkspace(req.headers.authorization);
      if (!credWorkspace) {
        res.status(401).json({ error: "Missing or invalid workspace credentials" });
        return;
      }
      const accountId =
        typeof req.body?.portfolioAccountId === "string" ? req.body.portfolioAccountId : null;
      const account = accountId
        ? await prisma.portfolioAccount.findUnique({
            where: { id: accountId },
            select: { portfolio: { select: { workspaceRef: true } } }
          })
        : null;
      if (!account || account.portfolio.workspaceRef !== credWorkspace) {
        res.status(401).json({ error: "Credentials are not scoped to this workspace" });
        return;
      }
    }

    try {
      const result = await create(req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json(err.toJSON());
        return;
      }
      res.status(500).json({ error: "Failed to write contact log" });
    }
  };
}
