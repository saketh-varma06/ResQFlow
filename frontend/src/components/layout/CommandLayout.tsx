import { BellRing, Building2, ClipboardCheck, Gift, HeartHandshake, History, LayoutDashboard, ScrollText, ShieldCheck, Siren, TriangleAlert, Users, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/context/AuthContext";
import type { NavItem } from "./nav";
const responderItems: NavItem[] = [
  { to: "/responder", label: "Command Centre", icon: LayoutDashboard, end: true },
  { to: "/responder/assigned", label: "Assigned Incidents", icon: ClipboardCheck },
  { to: "/responder/sos", label: "Incoming SOS", icon: Siren },
  { to: "/responder/history", label: "Response History", icon: History },
  { to: "/responder/missing", label: "Missing Persons", icon: HeartHandshake },
  { to: "/responder/map", label: "Operations Map", icon: LayoutDashboard },
];
const adminItems: NavItem[] = [
  { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/incidents", label: "Incident Management", icon: TriangleAlert },
  { to: "/admin/alerts", label: "Alert Management", icon: BellRing },
  { to: "/admin/shelters", label: "Shelter Management", icon: Building2 },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/responders", label: "Responder Management", icon: ShieldCheck },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/missing", label: "Missing Persons", icon: HeartHandshake },
  { to: "/admin/donations", label: "Donations", icon: Gift },
  { to: "/admin/map", label: "Operations Map", icon: LayoutDashboard },
];
function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return async () => { await logout(); navigate("/login", { replace: true }); };
}
export function ResponderLayout() {
  const { user } = useAuth();
  const onLogout = useLogout();
  const unit = user?.responderProfile;
  return <AppShell dark items={responderItems} roleLabel="Responder" userName={user?.name ?? "Responder"}
    userMeta={unit ? `${unit.unitName} · ${unit.unitType}` : (user?.email ?? "")} onLogout={onLogout} />;
}
export function AdminLayout() {
  const { user } = useAuth();
  const onLogout = useLogout();
  return <AppShell dark items={adminItems} roleLabel="Admin" userName={user?.name ?? "Administrator"}
    userMeta={user?.area ? `${user.area} · Administrator` : (user?.email ?? "")} onLogout={onLogout} />;
}
