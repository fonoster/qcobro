import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, WORKSPACE_KEY, queryClient } from "./trpc.js";

interface AuthContextValue {
  /** Access token, or null when logged out. Drives route guards. */
  accessToken: string | null;
  /** Active workspace accessKeyId, or null when none selected. */
  workspace: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setWorkspace: (accessKeyId: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY)
  );
  const [workspace, setWorkspaceState] = useState<string | null>(() =>
    localStorage.getItem(WORKSPACE_KEY)
  );

  const setTokens = useCallback((newAccessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setAccessToken(newAccessToken);
  }, []);

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
    localStorage.removeItem(WORKSPACE_KEY);
    setAccessToken(null);
    setWorkspaceState(null);
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      workspace,
      isAuthenticated: accessToken !== null,
      setTokens,
      setWorkspace,
      logout
    }),
    [accessToken, workspace, setTokens, setWorkspace, logout]
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
