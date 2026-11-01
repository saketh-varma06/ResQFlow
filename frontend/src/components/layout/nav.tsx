import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: string; end?: boolean }
export function SidebarNav({ items, dark, onNavigate }: { items: NavItem[]; dark?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Section" className="flex flex-col gap-1 px-3 pb-6">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            dark
              ? (isActive ? "bg-red-600 text-white shadow" : "text-slate-300 hover:bg-white/10 hover:text-white")
              : (isActive ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
          )}>
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.badge && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", dark ? "bg-red-500/25 text-red-200" : "bg-red-600 text-white")}>{item.badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
