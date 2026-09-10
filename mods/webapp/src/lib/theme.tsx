import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

/**
 * Appearance layer.
 *
 * `preference` is what the user chose: "system" follows the OS `prefers-color-scheme`,
 * "light" / "dark" pin a theme. `resolved` is the concrete theme in effect ("light" or
 * "dark") and is what gets written to `document.documentElement.dataset.theme` and drives
 * the CSS. The server profile is the source of truth; the localStorage cache only avoids a
 * flash of the wrong theme before the profile query resolves (and the pre-hydration script
 * in index.html covers the very first paint).
 */
export const themes = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themes)[number];
export type ResolvedTheme = "light" | "dark";

export const defaultTheme: ThemePreference = "system";

const THEME_STORAGE_KEY = "qcobro.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && (themes as readonly string[]).includes(value);
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

/** The preference to use before the server profile loads: the cached choice, else the default. */
export function readStoredTheme(): ThemePreference {
  try {
    const cached = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(cached)) return cached;
  } catch {
    // localStorage unavailable (SSR/private mode) — fall through to the default.
  }
  return defaultTheme;
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
  }
}

interface ThemeContextValue {
  /** What the user picked. */
  preference: ThemePreference;
  /** The concrete theme in effect right now. */
  resolved: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = readStoredTheme()
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(initialPreference));

  const setTheme = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore cache write failures; in-memory state still applies for this session.
    }
  }, []);

  // Keep `resolved` and the <html> attribute in sync with the preference, and — while the
  // preference is "system" — with live OS appearance changes.
  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyResolvedTheme(next);

    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      applyResolvedTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setTheme }),
    [preference, resolved, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
