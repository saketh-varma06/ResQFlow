import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";

export interface Toast { id: number; title: string; body?: string; kind: "sos" | "incident" | "alert" | "shelter" | "notification" | "system" }
interface RealtimeState {
  connected: boolean;
  toasts: Toast[];
  dismiss: (id: number) => void;
  /** Subscribe to raw socket events; returns unsubscribe. */
  on: (event: string, handler: (payload: never) => void) => () => void;
}
const Ctx = createContext<RealtimeState>({ connected: false, toasts: [], dismiss: () => undefined, on: () => () => undefined });
export const useRealtime = () => useContext(Ctx);

let toastSeq = 1;
const titleOf = (p: Record<string, unknown>, fallback: string) => (typeof p.title === "string" ? p.title : typeof p.need === "string" ? p.need : typeof p.name === "string" ? p.name : fallback);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const handlers = useRef(new Map<string, Set<(payload: never) => void>>());

  const push = useCallback((kind: Toast["kind"], title: string, body?: string) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 9000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const on = useCallback((event: string, handler: (payload: never) => void) => {
    if (!handlers.current.has(event)) handlers.current.set(event, new Set());
    handlers.current.get(event)!.add(handler);
    return () => { handlers.current.get(event)?.delete(handler); };
  }, []);

  useEffect(() => {
    if (!user) { disconnectSocket(); setConnected(false); return; }
    const s = getSocket();
    const emit = (event: string, payload: unknown) => handlers.current.get(event)?.forEach((h) => h(payload as never));
    const listeners: [string, (p: unknown) => void][] = [
      ["notification:new", (p) => { const n = p as { title: string; body: string }; push("notification", n.title, n.body); emit("notification:new", p); }],
      ["sos:created", (p) => { if (user.role !== "CITIZEN") push("sos", "New SOS request", titleOf(p as Record<string, unknown>, "")); emit("sos:created", p); }],
      ["sos:updated", (p) => { emit("sos:updated", p); }],
      ["incident:assigned", () => { if (user.role === "RESPONDER") push("incident", "New incident assignment", "Your unit was assigned an incident."); }],
      ["incident:created", (p) => { emit("incident:created", p); }],
      ["incident:updated", (p) => { emit("incident:updated", p); }],
      ["alert:created", (p) => { push("alert", "New disaster alert", titleOf(p as Record<string, unknown>, "")); emit("alert:created", p); }],
      ["shelter:updated", (p) => { emit("shelter:updated", p); }],
      ["shelter:created", (p) => { emit("shelter:created", p); }],
    ];
    for (const [event, fn] of listeners) s.on(event, fn);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) setConnected(true);
    if (!s.connected) s.connect();
    return () => {
      for (const [event, fn] of listeners) s.off(event, fn);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [user, push]);

  return <Ctx.Provider value={{ connected, toasts, dismiss, on }}>{children}</Ctx.Provider>;
}
