import { useEffect } from "react";
import { trpc } from "./trpc.js";
import { useI18n, type Language } from "./i18n.js";
import { useTheme, type ThemePreference } from "./theme.js";

/**
 * Reconcile the locally-cached language and appearance preferences with the user's profile,
 * which is the source of truth. Runs in every authenticated shell (AuthedLayout,
 * AccountLayout) so a preference set on one device shows up on the next visit here — even on
 * pages, like Mi perfil, that render outside the workspace shell.
 */
export function usePreferenceSync() {
  const { language, setLanguage } = useI18n();
  const { preference: theme, setTheme } = useTheme();
  const profile = trpc.profile.get.useQuery();

  const profileLanguage = profile.data?.language as Language | undefined;
  useEffect(() => {
    if (profileLanguage && profileLanguage !== language) setLanguage(profileLanguage);
  }, [profileLanguage, language, setLanguage]);

  const profileTheme = profile.data?.theme as ThemePreference | undefined;
  useEffect(() => {
    if (profileTheme && profileTheme !== theme) setTheme(profileTheme);
  }, [profileTheme, theme, setTheme]);
}
