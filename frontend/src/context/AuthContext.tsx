import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, type Envelope } from "@/lib/api";

export type Role = "CITIZEN" | "RESPONDER" | "ADMIN";
export interface AuthUser {
  id: string; name: string; email: string; role: Role; status: "ACTIVE" | "PENDING" | "SUSPENDED";
  area?: string | null; address?: string | null; phone?: string | null;
  responderProfile?: { id: string; unitName: string; unitType: string; base: string; readiness: string } | null;
}
export function roleHome(role: Role) { return role === "ADMIN" ? "/admin" : role === "RESPONDER" ? "/responder" : "/citizen"; }

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { name: string; email: string; phone?: string; password: string; role?: Role; area?: string; address?: string }) => Promise<{ user: AuthUser; pending: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<Envelope<AuthUser>>("/api/auth/me");
      setUser(r.data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setUser(null);
      else setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<Envelope<{ user: AuthUser; token: string }>>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; phone?: string; password: string; role?: Role; area?: string; address?: string }) => {
    const r = await api<Envelope<{ user: AuthUser; token: string | null; message?: string }>>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
    if (r.data.token) { setUser(r.data.user); return { user: r.data.user, pending: false }; }
    return { user: r.data.user, pending: true, message: r.data.message };
  }, []);

  const logout = useCallback(async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* session may already be gone */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
