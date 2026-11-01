import { Link } from "react-router-dom";
import { BedDouble, Bell, ClipboardList, Siren, TriangleAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type AnalyticsOverview, type ApiIncident, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import ExternalDataPanel from "@/components/ExternalDataPanel";

export default function AdminDashboard() {
  const a = useApi(() => api<Envelope<AnalyticsOverview>>("/api/analytics/overview"));
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=6"));
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=6"));
  const d = a.data?.data;
  return (
    <div>
      <PageHeader title="Admin dashboard" description="Live operational overview from the backend — every number below is computed from database records." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active incidents" value={a.loading ? "…" : String(d?.incidents.active ?? 0)} sub={`${d?.incidents.total ?? 0} total recorded`} icon={TriangleAlert} tone="red" />
        <StatCard label="Pending SOS" value={a.loading ? "…" : String(d?.sos.pending ?? 0)} sub={`${d?.sos.total ?? 0} total requests`} icon={Siren} tone="amber" />
        <StatCard label="Active alerts" value={a.loading ? "…" : String(d?.alerts.active ?? 0)} icon={Bell} tone="sky" />
        <StatCard label="Shelter utilization" value={a.loading ? "…" : `${d?.shelters.utilizationPercent ?? 0}%`} sub={`${d?.shelters.totalOccupied ?? 0} of ${d?.shelters.totalCapacity ?? 0} places`} icon={BedDouble} tone="green" />
        <StatCard label="Users" value={a.loading ? "…" : String(d?.users.total ?? 0)} sub={`${d?.users.byRole.RESPONDER ?? 0} responders · ${d?.users.byRole.CITIZEN ?? 0} citizens`} icon={Users} tone="slate" />
        <StatCard label="Assignments made" value={a.loading ? "…" : String(d?.assignments.total ?? 0)} icon={ClipboardList} tone="slate" />
      </div>
      {a.error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{a.error}</p>}
      <Card className="mt-6"><CardHeader><CardTitle>Incident trend — last 14 days</CardTitle></CardHeader><CardContent>
        {a.loading ? <LoadingCards count={1} /> : d && (
          <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.incidents.trends14Days}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} tickFormatter={(v: string) => v.slice(5)} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
            <Area type="monotone" dataKey="incidents" stroke="#dc2626" fill="#fecaca" name="Reported" />
            <Area type="monotone" dataKey="incidentsResolved" stroke="#059669" fill="#a7f3d0" name="Resolved" />
          </AreaChart></ResponsiveContainer></div>)}
      </CardContent></Card>
      <div className="mt-6"><ExternalDataPanel /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center justify-between">Latest incidents <Link to="/admin/incidents" className="text-sm font-semibold text-red-700 hover:underline">Manage</Link></CardTitle></CardHeader><CardContent className="space-y-2">
          {incidents.loading ? <LoadingCards count={2} /> : incidents.data && incidents.data.data.length ? incidents.data.data.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <span className="font-semibold">{i.title}</span>
              <span className="ml-auto flex gap-1.5"><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span>
              <span className="w-full text-xs text-muted-foreground">{titleCase(i.type)} · {i.location} · {fmtDate(i.createdAt)}</span>
            </div>)) : <EmptyState title="No incidents" />}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center justify-between">Latest SOS requests <Link to="/admin/map" className="text-sm font-semibold text-red-700 hover:underline">Open map</Link></CardTitle></CardHeader><CardContent className="space-y-2">
          {sos.loading ? <LoadingCards count={2} /> : sos.data && sos.data.data.length ? sos.data.data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <span className="font-semibold">{s.need}</span>
              <span className="ml-auto flex gap-1.5"><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /><StatusBadge status={s.status} /></span>
              <span className="w-full text-xs text-muted-foreground">{titleCase(s.category)} · {s.location} · {fmtDate(s.createdAt)}</span>
            </div>)) : <EmptyState title="No SOS requests" />}
        </CardContent></Card>
      </div>
    </div>
  );
}
