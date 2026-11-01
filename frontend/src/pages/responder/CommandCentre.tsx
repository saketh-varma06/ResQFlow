import { Link } from "react-router-dom";
import { ClipboardCheck, Radio, Siren, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import MapView from "@/components/MapView";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiIncident, type ApiResponderProfile, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import ExternalDataPanel from "@/components/ExternalDataPanel";

const READINESS = ["AVAILABLE", "DEPLOYED", "STANDBY", "OFF_DUTY"] as const;
export default function CommandCentre() {
  const [error, setError] = useState("");
  const profile = useApi(() => api<Envelope<ApiResponderProfile>>("/api/responders/me/profile"));
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=100"));
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=100"));
  const me = profile.data?.data;
  const active = (incidents.data?.data ?? []).filter((i) => !["RESOLVED", "CLOSED"].includes(i.status));
  const queue = [...active].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 8);
  const newSos = (sos.data?.data ?? []).filter((s) => s.status === "SUBMITTED" || s.status === "ACKNOWLEDGED");
  const myActive = (incidents.data?.data ?? []).filter((i) => i.assignments?.some((a) => a.responderProfile?.id === me?.id && ["PENDING", "ACCEPTED"].includes(a.status)));
  const markers = active.filter((i) => i.latitude && i.longitude).map((i) => ({ id: i.id, lat: i.latitude!, lng: i.longitude!, label: i.title, severity: (i.severity === "CRITICAL" ? "critical" : i.severity === "HIGH" ? "high" : i.severity === "MODERATE" ? "moderate" : "low") as "critical" | "high" | "moderate" | "low" }));

  async function setReadiness(readiness: string) {
    setError("");
    try { await api("/api/responders/me/availability", { method: "PATCH", body: JSON.stringify({ readiness }) }); void profile.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not update availability."); }
  }
  return (
    <div>
      <PageHeader title="Command centre" description="Live operations picture from the backend — priority queue, incoming SOS and your unit's status." />
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active incidents" value={incidents.loading ? "…" : String(active.length)} icon={TriangleAlert} tone="red" />
        <StatCard label="SOS awaiting action" value={sos.loading ? "…" : String(newSos.length)} icon={Siren} tone="amber" />
        <StatCard label="Assigned to my unit" value={String(myActive.length)} icon={ClipboardCheck} tone="sky" />
        <Card><CardContent className="py-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Radio className="h-4 w-4" aria-hidden /> My availability</p>
          <p className="mt-1 font-display text-lg font-bold">{me ? me.unitName : "…"}</p>
          <Select aria-label="My availability" className="mt-2" value={me?.readiness ?? "STANDBY"} onChange={(e) => void setReadiness(e.target.value)} disabled={!me}>
            {READINESS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </Select>
        </CardContent></Card>
      </div>
      <ExternalDataPanel />
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3"><CardHeader><CardTitle>Priority queue</CardTitle></CardHeader><CardContent className="space-y-2">
          {incidents.loading ? <LoadingCards count={3} /> : incidents.error ? <p role="alert" className="text-sm text-red-700">{incidents.error}</p>
            : queue.length === 0 ? <EmptyState title="No active incidents" description="The queue is clear." />
            : queue.map((i) => (
              <Link key={i.id} to={`/responder/incidents/${i.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm transition hover:border-red-300 hover:bg-red-50/40">
                <span className="font-semibold">{i.title}</span>
                <span className="ml-auto flex gap-1.5"><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span>
                <span className="w-full text-xs text-muted-foreground">{titleCase(i.type)} · {i.location} · {fmtDate(i.createdAt)}</span>
              </Link>))}
        </CardContent></Card>
        <div className="space-y-6 xl:col-span-2">
          <Card><CardHeader><CardTitle className="flex items-center justify-between">New SOS <Button asChild size="sm" variant="outline"><Link to="/responder/sos">Open inbox</Link></Button></CardTitle></CardHeader><CardContent className="space-y-2">
            {sos.loading ? <LoadingCards count={2} /> : newSos.length === 0 ? <EmptyState title="No waiting SOS" description="New requests appear here." />
              : newSos.slice(0, 4).map((s) => (
                <div key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{s.need}</span><span className="ml-auto"><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /></span></div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{titleCase(s.category)} · {s.location} · {fmtDate(s.createdAt)}</p>
                </div>))}
          </CardContent></Card>
          <Card><CardContent className="p-2"><MapView markers={markers} height={300} /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}
