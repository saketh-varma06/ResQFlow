import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiIncident, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

type Tab = "sos" | "incidents";
interface Detail { kind: Tab; sos?: ApiSos; incident?: ApiIncident }

function Timeline({ entries }: { entries: NonNullable<ApiSos["statusHistory"]> }) {
  if (!entries || entries.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {entries.map((h) => (
        <li key={h.id} className="text-sm">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
          <span className="font-semibold">{titleCase(h.toStatus)}</span>
          <span className="text-muted-foreground"> · {fmtDate(h.createdAt)}{h.changedBy ? ` · by ${h.changedBy.name} (${titleCase(h.changedBy.role)})` : ""}</span>
          {h.note && <p className="text-muted-foreground">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function RequestsPage() {
  const [tab, setTab] = useState<Tab>("sos");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const sos = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=50"));
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?mine=true&limit=50"));

  async function open(kind: Tab, id: string) {
    setError("");
    try {
      if (kind === "sos") { const r = await api<Envelope<ApiSos>>(`/api/sos/${id}`); setDetail({ kind, sos: r.data }); }
      else { const r = await api<Envelope<ApiIncident>>(`/api/incidents/${id}`); setDetail({ kind, incident: r.data }); }
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not load details."); }
  }
  async function cancelSos(id: string) {
    try { await api(`/api/sos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }); setDetail(null); void sos.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not cancel."); }
  }

  const loading = tab === "sos" ? sos.loading : incidents.loading;
  const loadError = tab === "sos" ? sos.error : incidents.error;

  return (
    <div>
      <PageHeader title="My requests" description="Track every SOS request and incident report you have submitted — statuses update as responders work." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Request type">
        {(["sos", "incidents"] as Tab[]).map((t) => (
          <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "sos" ? "SOS requests" : "Incident reports"}</Button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><LoadingCards count={3} /></div> : loadError ? <p role="alert" className="p-4 text-sm text-red-700">{loadError}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {tab === "sos" && (sos.data?.data.length ? sos.data.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><p className="font-semibold">{s.need}</p><p className="text-xs text-muted-foreground">{titleCase(s.category)} · {s.location}</p></TableCell>
                  <TableCell><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /></TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(s.createdAt)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void open("sos", s.id)}>View</Button></TableCell>
                </TableRow>)) : <TableRow><TableCell colSpan={5}><EmptyState title="No SOS requests" description="Your SOS requests will appear here." /></TableCell></TableRow>)}
              {tab === "incidents" && (incidents.data?.data.length ? incidents.data.data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">{titleCase(i.type)} · {i.location}</p></TableCell>
                  <TableCell><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /></TableCell>
                  <TableCell><span className="flex items-center gap-1.5"><SeverityBadge severity={i.severity} /><StatusBadge status={i.status} /></span></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(i.createdAt)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void open("incidents", i.id)}>View</Button></TableCell>
                </TableRow>)) : <TableRow><TableCell colSpan={5}><EmptyState title="No incident reports" description="Reports you submit will appear here." /></TableCell></TableRow>)}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.kind === "sos" ? detail.sos?.need : detail?.incident?.title}</DialogTitle></DialogHeader>
          {detail?.sos && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2"><StatusBadge status={detail.sos.status} /><PriorityBadge level={detail.sos.priorityLevel} score={detail.sos.priorityScore} /></div>
              <p className="text-muted-foreground">Request ID <code className="font-mono">{detail.sos.id}</code> · {titleCase(detail.sos.category)} · {detail.sos.location} · {detail.sos.people} people{detail.sos.trapped ? " · trapped" : ""}{detail.sos.injuriesReported ? ` · ${detail.sos.injuriesReported} injuries` : ""}</p>
              {detail.sos.responderProfile && <p>Assigned unit: <strong>{detail.sos.responderProfile.unitName}</strong> ({detail.sos.responderProfile.unitType})</p>}
              <div><p className="mb-2 font-semibold">Why this priority?</p><ul className="list-disc pl-5 text-muted-foreground">{detail.sos.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
              <div><p className="mb-2 font-semibold">Response history</p><Timeline entries={detail.sos.statusHistory ?? []} /></div>
              {(detail.sos.status === "SUBMITTED" || detail.sos.status === "ACKNOWLEDGED") && <Button variant="outline" onClick={() => void cancelSos(detail.sos!.id)}>Cancel this request</Button>}
            </div>
          )}
          {detail?.incident && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2"><SeverityBadge severity={detail.incident.severity} /><StatusBadge status={detail.incident.status} /><PriorityBadge level={detail.incident.priorityLevel} score={detail.incident.priorityScore} /></div>
              <p className="text-muted-foreground">{detail.incident.description}</p>
              <p className="text-muted-foreground">{titleCase(detail.incident.type)} · {detail.incident.location} · {detail.incident.peopleAffected} people affected</p>
              {detail.incident.assignments && detail.incident.assignments.length > 0 && <p>Assigned unit: <strong>{detail.incident.assignments[0].responderProfile?.unitName}</strong></p>}
              <div><p className="mb-2 font-semibold">Why this priority?</p><ul className="list-disc pl-5 text-muted-foreground">{detail.incident.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
              <div><p className="mb-2 font-semibold">Status history</p><Timeline entries={[...(detail.incident.statusHistory ?? [])].reverse()} /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
