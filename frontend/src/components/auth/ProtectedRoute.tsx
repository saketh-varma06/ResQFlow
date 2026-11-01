import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { roleHome, useAuth, type Role } from "@/context/AuthContext";

/** Route guard: requires a real backend session, optionally restricted to one role. */
export default function ProtectedRoute({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center p-8 text-sm text-muted-foreground" role="status">Checking your session…</div>;
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}
