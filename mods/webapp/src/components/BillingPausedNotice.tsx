import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { activeRole } from "../lib/workspaceRole.js";
import { BillingPausedBanner } from "./BillingPausedBanner.js";

/**
 * Self-contained paused-state notice for operational pages (Campañas): renders
 * nothing while dispatching is healthy; shows the role-aware banner when the
 * workspace is out of credits or the payer's charge failed. The CTA lands on
 * Facturación, where owners resolve it (upgrade or Stripe portal).
 */
export function BillingPausedNotice() {
  const { workspace, accessToken } = useAuth();
  // Paused state changes at cycle/dunning granularity — do not re-aggregate the
  // ledger on every page mount/refocus.
  const status = trpc.billing.status.useQuery(undefined, { staleTime: 60_000 });
  const navigate = useNavigate();
  const data = status.data;
  if (!data?.enabled || !("enrolled" in data) || !data.enrolled || !data.paused) return null;
  const isOwner = activeRole(accessToken, workspace) === "WORKSPACE_OWNER";
  return (
    <BillingPausedBanner
      variant={data.paused}
      isOwner={isOwner}
      onAction={() => navigate("/billing")}
    />
  );
}
