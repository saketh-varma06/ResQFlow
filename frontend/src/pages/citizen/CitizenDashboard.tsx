import { Link } from "react-router-dom";
import { Bell, ClipboardList, MapPin, Siren, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiAlert, type ApiIncident, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import ExternalDataPanel from "@/components/ExternalDataPanel";

export default function CitizenDashboard() {
  const { user } = useAuth();
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=50"));
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?mine=true&limit=50"));
  const alerts = useApi(() => api<ListEnvelope<ApiAlert>>("/api/alerts?limit=5"));
  const unread = useApi(() => api<Envelope<{ unread: number }>>("/api/notifications/unread-count"));
  const openSos = sos.data?.data.filter((s) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(s.status)) ?? [];
  const openInc = incidents.data?.data.filter((i) => !["RESOLVED", "CLOSED"].includes(i.status)) ?? [];

  return (
    <div>
      <PageHeader title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""}`} description="Your live ResQFlow overview — requests, alerts and notifications from the backend." actions={<Button asChild className="bg-red-600 hover:bg-red-700"><Link to="/citizen/sos"><Siren className="mr-1.5 h-4 w-4" aria-hidden /> Send SOS</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My open SOS requests" value={sos.loading ? "…" : String(openSos.length)} icon={Siren} tone="red" />
        <StatCard label="My open incident reports" value={incidents.loading ? "…" : String(openInc.length)} icon={TriangleAlert} tone="amber" />
        <StatCard label="Active alerts" value={alerts.loading ? "…" : String(alerts.data?.meta.total ?? 0)} icon={Bell} tone="sky" />
        <StatCard label="Unread notifications" value={unread.loading ? "…" : String(unread.data?.data.unread ?? 0)} icon={ClipboardList} tone="slate" />
      </div>

      <ExternalDataPanel />

      {alerts.data && alerts.data.data.length > 0 && (
        <Card className="mt-6 border-red-200">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-red-600" aria-hidden /> Latest active alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.data.data.slice(0, 3).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
                <SeverityBadge severity={a.severity} /><span className="font-semibold">{a.title}</span>
                <span className="text-muted-foreground">{a.area} · {fmtDate(a.issuedAt)}</span>
                <Link to="/citizen/alerts" className="ml-auto font-semibold text-red-700 hover:underline">View all</Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>My SOS requests</CardTitle></CardHeader><CardContent className="space-y-3">
          {sos.loading ? <LoadingCards count={2} /> : sos.error ? <p role="alert" className="text-sm text-red-700">{sos.error}</p>
            : sos.data && sos.data.data.length ? sos.data.data.slice(0, 4).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-semibold">{s.need}</span>
                <span className="ml-auto flex gap-1.5"><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /><StatusBadge status={s.status} /></span>
                <p className="w-full text-xs text-muted-foreground">{titleCase(s.category)} · {s.location} · {fmtDate(s.createdAt)}</p>
              </div>)) : <EmptyState title="No SOS requests" description="You have not submitted an SOS request yet." action={<Button asChild size="sm"><Link to="/citizen/sos">Send SOS</Link></Button>} />}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>My incident reports</CardTitle></CardHeader><CardContent className="space-y-3">
          {incidents.loading ? <LoadingCards count={2} /> : incidents.error ? <p role="alert" className="text-sm text-red-700">{incidents.error}</p>
            : incidents.data && incidents.data.data.length ? incidents.data.data.slice(0, 4).map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-semibold">{i.title}</span>
                <span className="ml-auto flex gap-1.5"><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span>
                <p className="w-full text-xs text-muted-foreground">{titleCase(i.type)} · {i.location} · {fmtDate(i.createdAt)}</p>
              </div>)) : <EmptyState title="No incident reports" description="Reports you submit will appear here." action={<Button asChild size="sm"><Link to="/citizen/report">Report an incident</Link></Button>} />}
          <div className="flex gap-2 pt-1">
            <Button asChild variant="outline" size="sm"><Link to="/citizen/requests">Track everything</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/citizen/shelters"><MapPin className="mr-1.5 h-4 w-4" aria-hidden /> Find shelters</Link></Button>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
