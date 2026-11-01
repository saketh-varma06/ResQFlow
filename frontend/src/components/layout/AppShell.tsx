import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Bell, LifeBuoy, LogOut, Menu, X } from "lucide-react";
import { SidebarNav, type NavItem } from "./nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api, type Envelope } from "@/lib/api";
import { useRealtime } from "@/context/RealtimeContext";

export function AppShell({ items, roleLabel, userName, userMeta, dark, notifyTo, onLogout, children }: {
  items: NavItem[]; roleLabel: string; userName: string; userMeta: string; dark?: boolean; notifyTo?: string; onLogout?: () => void; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { connected, on } = useRealtime();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!notifyTo) return;
    let cancelled = false;
    const load = async () => {
      try { const r = await api<Envelope<{ unread: number }>>("/api/notifications/unread-count"); if (!cancelled) setUnread(r.data.unread); }
      catch { /* badge simply stays as-is when the API is unreachable */ }
    };
    void load();
    const off = on("notification:new", () => { void load(); });
    return () => { cancelled = true; off(); };
  }, [notifyTo, on]);
  const location = useLocation();
  const initials = userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("min-h-screen bg-background text-foreground", dark && "command")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:text-slate-900 focus:p-2 focus:z-[60]">Skip to content</a>
      {/* Mobile overlay */}
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
        dark ? "border-white/10 bg-[#0a1122]" : "bg-white"
      )}>
        <div className="flex items-center gap-2 px-5 pb-2 pt-5">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="rounded-lg bg-red-600 p-1.5 text-white"><LifeBuoy className="h-5 w-5" aria-hidden /></span> ResQFlow
          </Link>
          <span className={cn("ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600")}>{roleLabel}</span>
          <button className="ml-auto rounded-md p-1.5 lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className={cn("mx-4 mb-4 mt-2 flex items-center gap-3 rounded-xl border p-3", dark ? "border-white/10 bg-white/5" : "bg-slate-50")}>
          <Avatar><AvatarFallback aria-hidden>{initials}</AvatarFallback></Avatar>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{userName}</p><p className={cn("truncate text-xs", dark ? "text-slate-400" : "text-muted-foreground")}>{userMeta}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto"><SidebarNav items={items} dark={dark} onNavigate={() => setOpen(false)} /></div>
        {onLogout && (
          <div className={cn("border-t px-4 pt-3", dark ? "border-white/10" : "")}>
            <button type="button" onClick={onLogout} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", dark ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        )}
        <div className={cn("p-4 text-xs", dark ? "text-slate-400" : "text-muted-foreground")}>
          In a life-threatening emergency, call <strong className={dark ? "text-white" : "text-slate-900"}>112</strong> first.
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className={cn("sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6", dark ? "border-white/10 bg-[#0a1122]/85" : "bg-white/85")}>
          <button className="rounded-md p-2 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="ml-auto hidden items-center gap-2 text-xs font-semibold md:flex" role="status" aria-label={connected ? "Realtime connection live" : "Realtime connection offline"}>
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} /> {connected ? "Live" : "Reconnecting…"}
          </span>
          {notifyTo && (<Link to={notifyTo} className="relative ml-auto rounded-lg border p-2 md:ml-0" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}</Link>)}
        </header>
        <main id="main" key={location.pathname} className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
