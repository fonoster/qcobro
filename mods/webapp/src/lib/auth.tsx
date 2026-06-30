import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  ID_TOKEN_KEY,
  WORKSPACE_KEY,
  queryClient,
  trpcClient
} from "./trpc.js";

export interface CurrentUser {
  name: string;
  email: string;
  initials: string;
}

interface AuthContextValue {
  /** Access token, or null when logged out. Drives route guards. */
  accessToken: string | null;
  /** Active workspace accessKeyId, or null when none selected. */
  workspace: string | null;
  isAuthenticated: boolean;
  /** Decoded from the id token (name/email), or null. */
  currentUser: CurrentUser | null;
  setTokens: (accessToken: string, refreshToken: string, idToken?: string) => void;
  setWorkspace: (accessKeyId: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function initials(name: string, email: string): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  const parts = base.split(/[\s.]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return chars.toUpperCase() || "QC";
}

function decodeUser(idToken: string | null): CurrentUser | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(decodeURIComponent(escape(json))) as {
      name?: string;
      email?: string;
    };
    const name = claims.name ?? "";
    const email = claims.email ?? "";
    if (!name && !email) return null;
    return { name: name || email, email, initials: initials(name, email) };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY)
  );
  const [idToken, setIdToken] = useState<string | null>(() => localStorage.getItem(ID_TOKEN_KEY));
  const [workspace, setWorkspaceState] = useState<string | null>(() =>
    localStorage.getItem(WORKSPACE_KEY)
  );

  const setTokens = useCallback(
    (newAccessToken: string, refreshToken: string, newIdToken?: string) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      setAccessToken(newAccessToken);
      if (newIdToken) {
        localStorage.setItem(ID_TOKEN_KEY, newIdToken);
        setIdToken(newIdToken);
      }
    },
    []
  );

  const setWorkspace = useCallback((accessKeyId: string | null) => {
    if (accessKeyId) {
      localStorage.setItem(WORKSPACE_KEY, accessKeyId);
    } else {
      localStorage.removeItem(WORKSPACE_KEY);
    }
    setWorkspaceState(accessKeyId);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    setAccessToken(null);
    setIdToken(null);
    setWorkspaceState(null);
    queryClient.clear();
  }, []);

  // Schedule a silent refresh ~60 s before the access token expires so the user
  // is never logged out mid-session. On a failed refresh (e.g. expired refresh
  // token) we log out immediately so the UI doesn't show stale data.
  useEffect(() => {
    if (!accessToken) return;
    let exp: number | undefined;
    try {
      const payload = accessToken.split(".")[1];
      const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
        exp?: number;
      };
      exp = claims.exp;
    } catch {
      return;
    }
    if (!exp) return;
    const msUntilRefresh = Math.max(0, exp * 1000 - Date.now() - 60_000);
    const timer = window.setTimeout(async () => {
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefresh) {
        logout();
        return;
      }
      try {
        const result = await trpcClient.auth.refresh.mutate({ refreshToken: storedRefresh });
        if (result.accessToken) {
          setTokens(
            result.accessToken,
            result.refreshToken ?? storedRefresh,
            (result as { idToken?: string }).idToken
          );
        } else {
          logout();
        }
      } catch {
        logout();
      }
    }, msUntilRefresh);
    return () => window.clearTimeout(timer);
  }, [accessToken, setTokens, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      workspace,
      isAuthenticated: accessToken !== null,
      currentUser: decodeUser(idToken),
      setTokens,
      setWorkspace,
      logout
    }),
    [accessToken, idToken, workspace, setTokens, setWorkspace, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
