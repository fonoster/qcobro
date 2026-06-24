import { useState } from "react";
import {
  Megaphone,
  Info,
  AlertTriangle,
  Sparkles,
  Rocket,
  Bell,
  X,
  type LucideIcon
} from "lucide-react";
import type { LocalizedString } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n, defaultLanguage } from "../lib/i18n.js";
import { cn } from "@/lib/utils.js";

const ICONS: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  info: Info,
  "alert-triangle": AlertTriangle,
  sparkles: Sparkles,
  rocket: Rocket,
  bell: Bell
};

const VARIANTS: Record<string, string> = {
  announcement: "bg-blue-50 text-blue-800",
  alert: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-800",
  danger: "bg-red-50 text-red-800"
};

const DISMISS_KEY = "qcobro.announcement.dismissed";

/** Resolve a localized config value against the active UI language, with fallback. */
function resolveLocalized(value: LocalizedString, language: string): string {
  if (typeof value === "string") return value;
  return value[language] ?? value[defaultLanguage] ?? Object.values(value)[0] ?? "";
}

/**
 * Deployment-wide announcement banner, configured in `qcobro.json` and served via
 * `config.announcement`. Renders nothing when no announcement is configured or it
 * was dismissed. Shown across the console and the workspace picker.
 */
export function AnnouncementBanner() {
  const { t, language } = useI18n();
  const { data } = trpc.config.announcement.useQuery();
  const [dismissed, setDismissed] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null
  );

  if (!data || data.enabled === false) return null;

  // Signature changes when the message changes, so a new announcement re-appears
  // even if a previous one was dismissed.
  const signature = JSON.stringify(data.message);
  if (data.dismissible && dismissed === signature) return null;

  const message = resolveLocalized(data.message, language);
  if (!message) return null;
  const title = data.title ? resolveLocalized(data.title, language) : null;
  const Icon = ICONS[data.icon] ?? Megaphone;

  function dismiss() {
    if (typeof localStorage !== "undefined") localStorage.setItem(DISMISS_KEY, signature);
    setDismissed(signature);
  }

  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-3 px-10 py-2.5 text-sm",
        VARIANTS[data.variant] ?? VARIANTS.announcement
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <p className="flex-1">
        {title && <span className="font-medium">{title}: </span>}
        {message}
      </p>
      {data.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.dismiss")}
          className="shrink-0 cursor-pointer rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
