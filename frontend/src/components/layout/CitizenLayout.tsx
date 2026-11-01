import { Bell, Home, MapPin, Siren, ClipboardList, UserRound, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/context/AuthContext";
import type { NavItem } from "./nav";
const items: NavItem[] = [
  { to: "/citizen", label: "Dashboard", icon: Home, end: true },
  { to: "/citizen/sos", label: "SOS Emergency", icon: Siren },
  { to: "/citizen/report", label: "Report Incident", icon: TriangleAlert },
  { to: "/citizen/shelters", label: "Find Shelters", icon: MapPin },
  { to: "/citizen/map", label: "Area Map", icon: MapPin },
  { to: "/citizen/alerts", label: "Disaster Alerts", icon: Bell },
  { to: "/citizen/requests", label: "My Requests", icon: ClipboardList },
  { to: "/citizen/notifications", label: "Notifications", icon: Bell },
  { to: "/citizen/profile", label: "Profile", icon: UserRound },
];
export default function CitizenLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return <AppShell items={items} roleLabel="Citizen" userName={user?.name ?? "Citizen"} userMeta={user?.area ?? user?.email ?? ""} notifyTo="/citizen/notifications"
    onLogout={async () => { await logout(); navigate("/login", { replace: true }); }} />;
}
