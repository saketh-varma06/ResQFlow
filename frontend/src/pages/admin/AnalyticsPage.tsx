import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BedDouble, ClipboardCheck, Clock3, Siren, TriangleAlert } from "lucide-react";
import { api, type Envelope } from "@/lib/api";
import { SitrepPanel } from "@/components/SitrepPanel";
import { ReplayPanel } from "@/components/ReplayPanel";
import { titleCase, type AnalyticsOverview } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const SEV_COLORS: Record<string, string> = { CRITICAL: "#dc2626", HIGH: "#ea580c", MODERATE: "#d97706", LOW: "#0284c7" };
const PIE_COLORS = ["#dc2626", "#ea580c", "#d97706", "#0284c7", "#059669", "#7c3aed", "#db2777", "#64748b", "#0f766e"];
const fmtMin = (m: number | null) => m === null ? "—" : m >= 120 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`;

export default function AnalyticsPage() {
  const a = useApi(() => api<Envelope<AnalyticsOverview>>("/api/analytics/overview"));
  const d = a.data?.data;
  if (a.loading) return <div><PageHeader title="Analytics" description="Operational analytics computed from live database records." /><LoadingCards count={4} /></div>;
  if (a.error || !d) return <div><PageHeader title="Analytics" /><p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{a.error || "No data"}</p></div>;

  const sevData = Object.entries(d.incidents.bySeverity).map(([k, v]) => ({ name: titleCase(k), value: v, key: k }));
  const typeData = Object.entries(d.incidents.byType).map(([k, v]) => ({ name: titleCase(k), value: v }));
  return (
    <div>
      <PageHeader title="Analytics" description={`Computed from live database records · generated ${new Date(d.generatedAt).toLocaleTimeString()}. Nothing here is hardcoded.`} />
      <SitrepPanel />
      <ReplayPanel />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending SOS requests" value={String(d.sos.pending)} sub={d.sos.oldestPendingMinutes !== null ? `Oldest waiting ${fmtMin(d.sos.oldestPendingMinutes)}` : "Queue clear"} icon={Siren} tone="red" />
        <StatCard label="Avg acknowledgement (SOS)" value={fmtMin(d.response.avgAcknowledgementMinutes.sos)} sub={`Incidents: ${fmtMin(d.response.avgAcknowledgementMinutes.incidents)}`} icon={Clock3} tone="amber" />
        <StatCard label="Avg resolution (incidents)" value={fmtMin(d.response.avgResolutionMinutes.incidents)} sub={`SOS: ${fmtMin(d.response.avgResolutionMinutes.sos)}`} icon={Activity} tone="sky" />
        <StatCard label="Shelter utilization" value={`${d.shelters.utilizationPercent}%`} sub={`${d.shelters.totalOccupied} of ${d.shelters.totalCapacity} places`} icon={BedDouble} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Incidents by severity</CardTitle></CardHeader><CardContent>
          {sevData.length === 0 ? <EmptyState title="No incidents yet" /> : (
            <div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={sevData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Incidents" radius={[4, 4, 0, 0]}>{sevData.map((s) => <Cell key={s.key} fill={SEV_COLORS[s.key] ?? "#64748b"} />)}</Bar></BarChart></ResponsiveContainer></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Incidents by category</CardTitle></CardHeader><CardContent>
          {typeData.length === 0 ? <EmptyState title="No incidents yet" /> : (
            <div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={typeData} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>{typeData.map((t, i) => <Cell key={t.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>)}
        </CardContent></Card>
      </div>
      <Card className="mt-6"><CardHeader><CardTitle>Trends — last 14 days (reported vs resolved vs SOS)</CardTitle></CardHeader><CardContent>
        <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.incidents.trends14Days}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} tickFormatter={(v: string) => v.slice(5)} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
          <Area type="monotone" dataKey="incidents" stroke="#dc2626" fill="#fecaca" name="Incidents reported" />
          <Area type="monotone" dataKey="incidentsResolved" stroke="#059669" fill="#a7f3d0" name="Incidents resolved" />
          <Area type="monotone" dataKey="sos" stroke="#0284c7" fill="#bae6fd" name="SOS submitted" />
        </AreaChart></ResponsiveContainer></div>
      </CardContent></Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-4 w-4" aria-hidden /> Shelter capacity utilization</CardTitle></CardHeader><CardContent className="space-y-4">
          {d.shelters.perShelter.length === 0 ? <EmptyState title="No shelters" /> : d.shelters.perShelter.map((s) => (
            <div key={s.id}>
              <div className="flex items-baseline justify-between text-sm"><span className="font-semibold">{s.name}</span><span className="text-muted-foreground">{s.occupied}/{s.capacity} · {s.utilizationPercent}%</span></div>
              <Progress value={s.utilizationPercent} className="mt-1" aria-label={`${s.name} utilization`} />
              <p className="mt-0.5 text-xs text-muted-foreground">{s.area} · {s.available} places available</p>
            </div>))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" aria-hidden /> Responder workload</CardTitle></CardHeader><CardContent className="p-0">
          {d.responderWorkload.length === 0 ? <div className="p-4"><EmptyState title="No responder units" /></div> : (
            <Table><TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Status</TableHead><TableHead>Active work</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader><TableBody>
              {d.responderWorkload.map((w) => (
                <TableRow key={w.profileId}><TableCell><p className="font-semibold">{w.unitName}</p><p className="text-xs text-muted-foreground">{w.unitType} · {w.members} members</p></TableCell>
                  <TableCell><StatusBadge status={w.readiness} /></TableCell>
                  <TableCell>{w.activeAssignments} incidents · {w.activeSos} SOS</TableCell>
                  <TableCell>{w.completedAssignments} incidents · {w.resolvedSos} SOS</TableCell></TableRow>))}
            </TableBody></Table>)}
          <p className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground"><TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Averages are computed from status-history timestamps — first acknowledgement / resolution per record.</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
