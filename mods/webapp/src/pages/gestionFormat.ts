import { localDateString, startOfLocalDay } from "@qcobro/common";
import { Bot, AudioLines, MessageSquare, Mail, MessageCircle } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Formatting shared by Gestiones, the gestión drawer and Promesas de pago: the design's
 * dates ("Hoy 14:32", "18 nov 15:02", "18 nov 2026, 17:48", "25 nov 2026"), phones
 * ("+1 829 555 4321") and the per-channel icon (bot, audio-lines, message-square…).
 */

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  VOICE_AI: Bot,
  VOICE_PRERECORDED: AudioLines,
  SMS: MessageSquare,
  EMAIL: Mail,
  WHATSAPP: MessageCircle
};

export function gestionChannelIcon(channel: string): ComponentType<{ className?: string }> {
  return ICONS[channel] ?? MessageSquare;
}

/** The browser's timezone, used until the workspace's loads. */
export function resolveTimeZone(tz: string | undefined): string {
  return tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const stripDots = (s: string) => s.replace(/\./g, "");

function time(date: Date, language: string, timeZone: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone
  }).format(date);
}

/** "25 nov 2026" (or "25 nov" with `withYear: false`). */
export function formatDay(
  value: Date | string,
  language: string,
  timeZone: string,
  withYear = true
): string {
  return stripDots(
    new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone
    }).format(new Date(value))
  );
}

/** "vie 21 nov": a promise's due day, next to its amount. */
export function formatWeekday(value: Date | string, language: string, timeZone: string): string {
  return stripDots(
    new Intl.DateTimeFormat(language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone
    }).format(new Date(value))
  ).replace(",", "");
}

/** List dates: "Hoy 14:32", "Ayer 17:48", "18 nov 15:02" (with the year when not this year). */
export function formatListDate(
  value: Date | string,
  language: string,
  timeZone: string,
  words: { today: string; yesterday: string }
): string {
  const date = new Date(value);
  const now = new Date();
  const day = localDateString(date, timeZone);
  const today = localDateString(now, timeZone);
  const yesterday = localDateString(new Date(now.getTime() - 86_400_000), timeZone);
  const hhmm = time(date, language, timeZone);
  if (day === today) return `${words.today} ${hhmm}`;
  if (day === yesterday) return `${words.yesterday} ${hhmm}`;
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return `${formatDay(date, language, timeZone, !sameYear)} ${hhmm}`;
}

/** "18 nov 2026, 17:48". */
export function formatFullDate(value: Date | string, language: string, timeZone: string): string {
  const date = new Date(value);
  return `${formatDay(date, language, timeZone)}, ${time(date, language, timeZone)}`;
}

/** "Hoy, 10:05" for thread replies: the list date with a comma. */
export function formatReplyDate(
  value: Date | string,
  language: string,
  timeZone: string,
  words: { today: string; yesterday: string }
): string {
  return formatListDate(value, language, timeZone, words).replace(/ (\d\d:\d\d)$/, ", $1");
}

/** "+1 829 555 4321" for a North American E.164 number; anything else is shown as stored. */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+1 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

/** "2:14" from seconds. */
export function formatDuration(seconds?: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type GestionPeriod = "today" | "7d" | "30d" | "custom";

/**
 * The `from`/`to` bounds for the Gestiones time filter. Presets set only `from`, so a gestión
 * that streams in after the page loaded still matches. Custom days are inclusive.
 */
export function periodBounds(
  period: GestionPeriod,
  timeZone: string,
  custom: { from: string; to: string }
): { from?: string; to?: string } {
  const now = new Date();
  if (period === "today") {
    return { from: startOfLocalDay(localDateString(now, timeZone), timeZone).toISOString() };
  }
  if (period === "7d" || period === "30d") {
    const days = period === "7d" ? 7 : 30;
    // Rounded to the minute so the query key stays stable across re-renders.
    const from = Math.floor((now.getTime() - days * 86_400_000) / 60_000) * 60_000;
    return { from: new Date(from).toISOString() };
  }
  const bounds: { from?: string; to?: string } = {};
  if (custom.from) bounds.from = startOfLocalDay(custom.from, timeZone).toISOString();
  if (custom.to) {
    const next = new Date(Date.parse(`${custom.to}T12:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    bounds.to = new Date(startOfLocalDay(next, timeZone).getTime() - 1).toISOString();
  }
  return bounds;
}

/** `YYYY-MM-DD` `days` ago in the timezone, for the custom range's defaults. */
export function localDayOffset(days: number, timeZone: string): string {
  return localDateString(new Date(Date.now() - days * 86_400_000), timeZone);
}
