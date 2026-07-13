import type {
  WhatsAppIntegrationClient,
  WhatsAppIntegrationRecord,
  WhatsAppIntegrationView
} from "@qcobro/common";
import {
  checkWhatsAppConnection,
  type WhatsAppConnectionCheckSettings
} from "../../services/metaWhatsAppClient.js";

/** Graph API connection defaults needed to reach Meta for the reachability check. */
export interface WhatsAppApiSettings {
  apiBaseUrl: string;
  apiVersion: string;
}

/** Confirms a WABA/token combination is still reachable. Injectable so tests never call Meta. */
export type WhatsAppConnectionChecker = (
  settings: WhatsAppConnectionCheckSettings
) => Promise<boolean>;

/** How long a reachability check is trusted before the badge re-checks Meta. */
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheFresh(row: WhatsAppIntegrationRecord): boolean {
  return row.lastCheckedAt != null && Date.now() - row.lastCheckedAt.getTime() < CACHE_TTL_MS;
}

/**
 * Read the active workspace's WhatsApp integration, projected to a client-safe
 * {@link WhatsAppIntegrationView}. The encrypted `accessToken` is NEVER included —
 * the view exposes only whether the WABA is connected plus the non-secret fields the
 * console needs. A workspace with no integration row returns `connected: false`.
 *
 * A stored row alone does NOT mean `connected: true` — a revoked or expired token would
 * still show green if we trusted the row's mere existence. Instead `connected` reflects a
 * real Meta reachability check (`checkConnection`), cached on the row for
 * {@link CACHE_TTL_MS} so the badge doesn't call Meta on every render/poll. The cache is
 * invalidated (by `upsertWhatsAppIntegration`, resetting these columns to null) whenever the
 * credentials change, so a rotated token is always re-validated rather than trusting a check
 * that ran against the old one.
 */
export function createGetWhatsAppIntegration(
  client: WhatsAppIntegrationClient,
  api: WhatsAppApiSettings,
  checkConnection: WhatsAppConnectionChecker = checkWhatsAppConnection
) {
  return async (workspaceRef: string): Promise<WhatsAppIntegrationView> => {
    const row = await client.whatsAppIntegration.findUnique({ where: { workspaceRef } });
    if (!row) {
      return { connected: false, wabaId: "", verifyToken: "", defaultLanguage: "" };
    }

    const connected = isCacheFresh(row)
      ? !!row.lastCheckedOk
      : await refreshConnectionStatus(client, row, api, checkConnection);

    return {
      connected,
      wabaId: row.wabaId,
      verifyToken: row.verifyToken,
      defaultLanguage: row.defaultLanguage
    };
  };
}

/** Runs the reachability check, persists the result on the row, and returns it. */
async function refreshConnectionStatus(
  client: WhatsAppIntegrationClient,
  row: WhatsAppIntegrationRecord,
  api: WhatsAppApiSettings,
  checkConnection: WhatsAppConnectionChecker
): Promise<boolean> {
  let ok: boolean;
  try {
    ok = await checkConnection({
      wabaId: row.wabaId,
      accessToken: row.accessToken,
      apiBaseUrl: api.apiBaseUrl,
      apiVersion: api.apiVersion
    });
  } catch {
    // A misbehaving checker (or an unexpected throw) still means "not confirmed connected" —
    // never let a Meta-side failure surface as an error on the integrations page.
    ok = false;
  }

  await client.whatsAppIntegration.update({
    where: { workspaceRef: row.workspaceRef },
    data: { lastCheckedAt: new Date(), lastCheckedOk: ok }
  });

  return ok;
}
