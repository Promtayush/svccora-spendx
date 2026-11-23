import { useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = getToken();
  const { isRefreshing, error, refreshUser } = useAuth();

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshUser().catch(() => undefined);
  }, [token, refreshUser]);

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (isRefreshing) {
    return <div className="p-6 text-muted-foreground">Refreshing session...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        {error}
        <button className="ml-2 underline" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
