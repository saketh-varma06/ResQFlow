import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, ClipboardCheck, Siren } from "lucide-react";
import { api, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiIncident, type ApiResponderProfile, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

export default function HistoryPage() {
  const profile = useApi(() => api<Envelope<ApiResponderProfile>>("/api/responders/me/profile"));
  const myId = profile.data?.data.id;
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=100"));
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=100"));
  const doneIncidents = (incidents.data?.data ?? []).filter((i) => i.assignments?.some((a) => a.responderProfile?.id === myId) && ["RESOLVED", "CLOSED"].includes(i.status));
  const doneSos = (sos.data?.data ?? []).filter((s) => s.responderProfile?.id === myId && ["RESOLVED", "CLOSED"].includes(s.status));
  const loading = incidents.loading || sos.loading || profile.loading;
  return (
    <div>
      <PageHeader title="Response history" description="Completed work for your unit, from the backend." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Incidents completed" value={loading ? "…" : String(doneIncidents.length)} icon={ClipboardCheck} tone="green" />
        <StatCard label="SOS completed" value={loading ? "…" : String(doneSos.length)} icon={Siren} tone="green" />
        <StatCard label="Total completed" value={loading ? "…" : String(doneIncidents.length + doneSos.length)} icon={CheckCircle2} tone="slate" />
      </div>
      <Card className="mt-6"><CardContent className="p-0">
        {loading ? <div className="p-4"><LoadingCards count={3} /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Priority</TableHead><TableHead>Final status</TableHead><TableHead>Completed / updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {doneIncidents.length === 0 && doneSos.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState title="No completed work yet" description="Resolved incidents and SOS requests handled by your unit will appear here." /></TableCell></TableRow> : (<>
                {doneIncidents.map((i) => (
                  <TableRow key={`i-${i.id}`}><TableCell><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">Incident · {titleCase(i.type)} · {i.location}</p></TableCell>
                    <TableCell><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /></TableCell><TableCell><StatusBadge status={i.status} /></TableCell><TableCell className="whitespace-nowrap">{fmtDate(i.updatedAt)}</TableCell></TableRow>))}
                {doneSos.map((s) => (
                  <TableRow key={`s-${s.id}`}><TableCell><p className="font-semibold">{s.need}</p><p className="text-xs text-muted-foreground">SOS · {titleCase(s.category)} · {s.location}</p></TableCell>
                    <TableCell><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /></TableCell><TableCell><StatusBadge status={s.status} /></TableCell><TableCell className="whitespace-nowrap">{fmtDate(s.updatedAt)}</TableCell></TableRow>))}
              </>)}
            </TableBody>
          </Table>)}
      </CardContent></Card>
    </div>
  );
}
