import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { getToken, setUser as storeUser, type AuthUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isRefreshing: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(() => Boolean(getToken()));
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const currentUser = await apiFetch<AuthUser>("/api/me");
      storeUser(currentUser);
      setUser(currentUser);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to refresh your session"
      );
      throw requestError;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isRefreshing, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
