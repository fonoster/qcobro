import type { Request, Response } from "express";
import { getLogger } from "@fonoster/logger";
import type { VoiceCallRecordsClient } from "@qcobro/common";

const logger = getLogger({ service: "gestion-recording", filePath: import.meta.url });

export interface GestionRecordingDeps {
  /** Verifies the Bearer token and the caller's membership of the requested workspace. */
  authenticate: (
    token: string | null,
    workspace: string | null
  ) => Promise<{ accessKeyId: string } | null>;
  prisma: {
    accountContactLog: {
      findFirst(args: {
        where: { id: string; portfolioAccount: { portfolio: { workspaceRef: string } } };
        select: { providerRef: true };
      }): Promise<{ providerRef: string | null } | null>;
    };
  };
  callRecords: Pick<VoiceCallRecordsClient, "getRecording">;
}

function header(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * `GET /api/gestiones/:id/recording`: streams a gestión's recording (the redacted copy) from
 * Fonoster to the console, which fetches it with its Bearer token and `x-workspace` header
 * and plays it as a blob. The call ref comes only from the gestión, loaded with the caller's
 * workspace filter: nothing from the client reaches Fonoster but the gestión id, and no
 * Fonoster credential or URL reaches the browser. 401 without a valid token and workspace;
 * 404 when the gestión isn't in that workspace, has no call ref, or its record has no
 * recording; 502 when Fonoster can't be reached.
 */
export function createGestionRecordingHandler(deps: GestionRecordingDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const token = header(req.headers.authorization)?.replace(/^Bearer /, "") || null;
    const workspace = await deps.authenticate(token, header(req.headers["x-workspace"]));
    if (!workspace) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const gestion = await deps.prisma.accountContactLog.findFirst({
      where: {
        id: String(req.params.id),
        portfolioAccount: { portfolio: { workspaceRef: workspace.accessKeyId } }
      },
      select: { providerRef: true }
    });
    if (!gestion?.providerRef) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }

    try {
      const { data } = await deps.callRecords.getRecording(gestion.providerRef);
      res.status(200).setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "private, no-store");
      res.send(Buffer.from(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The records API answers 404 (no recording) or 410 (erased); anything else is Fonoster
      // being unreachable, not a missing recording.
      const status = (err as { status?: unknown }).status;
      if (status === 404 || status === 410) {
        logger.verbose(`no recording for gestión ${req.params.id}: ${message}`);
        res.status(404).json({ error: "Recording not found" });
        return;
      }
      logger.error(`recording fetch failed for gestión ${req.params.id}: ${message}`);
      res.status(502).json({ error: "Recording unavailable" });
    }
  };
}
