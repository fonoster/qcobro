import type { Request, Response } from "express";
import { ValidationError } from "@qcobro/common";
import { createCreateContactLog } from "../functions/campaigns/createContactLog.js";
import { createGetWorkspaceSettings } from "../functions/workspaceSettings/getWorkspaceSettings.js";

/** Minimal shape of the config slice this module needs. */
export interface ContactLogAuthConfig {
  apiserver: { contactLogAuth: { enabled: boolean } };
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
  const getSettings = createGetWorkspaceSettings(prisma as never);

  return async (req: Request, res: Response): Promise<void> => {
    // Resolve the referenced account's owning workspace up front: it scopes auth AND
    // provides the timezone used for the daily-cap reset.
    const accountId =
      typeof req.body?.portfolioAccountId === "string" ? req.body.portfolioAccountId : null;
    const account = accountId
      ? await prisma.portfolioAccount.findUnique({
          where: { id: accountId },
          select: { portfolio: { select: { workspaceRef: true } } }
        })
      : null;

    if (config.apiserver.contactLogAuth.enabled) {
      const credWorkspace = parseBasicWorkspace(req.headers.authorization);
      if (!credWorkspace) {
        res.status(401).json({ error: "Missing or invalid workspace credentials" });
        return;
      }
      if (!account || account.portfolio.workspaceRef !== credWorkspace) {
        res.status(401).json({ error: "Credentials are not scoped to this workspace" });
        return;
      }
    }

    if (!account) {
      res.status(400).json({ error: "Unknown portfolioAccountId" });
      return;
    }

    try {
      // Reset the daily cap in the account's workspace timezone, matching the engine and
      // tRPC paths. Every workspace has a settings row (seeded on read), so it always resolves.
      const timeZone = (await getSettings(account.portfolio.workspaceRef)).timezone;
      const result = await createCreateContactLog(prisma as never, timeZone)(req.body);
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
