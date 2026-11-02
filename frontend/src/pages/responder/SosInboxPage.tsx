import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, StatusBadge, VerificationBadge } from "@/components/StatusBadge";
import { VerificationPanel } from "@/components/VerificationPanel";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiResponderProfile, type ApiSos } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

export default function SosInboxPage() {
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ApiSos | null>(null);
  const list = useApi(() => api<ListEnvelope<ApiSos>>("/api/sos?limit=100"));
  const profile = useApi(() => api<Envelope<ApiResponderProfile>>("/api/responders/me/profile"));
  const myId = profile.data?.data.id;
  const rows = [...(list.data?.data ?? [])].sort((a, b) => b.priorityScore - a.priorityScore);

  async function act(id: string, action: "ack" | "assign" | "start" | "resolve" | "release") {
    setError("");
    try {
      if (action === "ack") await api(`/api/sos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "ACKNOWLEDGED" }) });
      if (action === "assign") await api(`/api/sos/${id}/assign`, { method: "POST", body: JSON.stringify({ responderProfileId: myId }) });
      if (action === "release") await api(`/api/sos/${id}/release`, { method: "POST" });
      if (action === "start") await api(`/api/sos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "IN_PROGRESS" }) });
      if (action === "resolve") await api(`/api/sos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED" }) });
      void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Action failed."); }
  }
  async function open(id: string) {
    try { const r = await api<Envelope<ApiSos>>(`/api/sos/${id}`); setDetail(r.data); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load details."); }
  }

  return (
    <div>
      <PageHeader title="Incoming SOS" description="Live SOS queue from the backend, sorted by priority score. Acknowledge, take assignments and update progress — every step is validated against the workflow." />
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Unit</TableHead><TableHead>Received</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No SOS requests" description="New SOS requests will appear here in real time." /></TableCell></TableRow>
                : rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><p className="font-semibold">{s.need}</p><p className="text-xs text-muted-foreground">{titleCase(s.category)} · {s.location} · {s.people} people{s.trapped ? " · trapped" : ""}{s.injuriesReported ? ` · ${s.injuriesReported} injuries` : ""}</p><span className="mt-1 inline-block"><VerificationBadge status={s.verificationStatus} /></span></TableCell>
                    <TableCell><PriorityBadge level={s.priorityLevel} score={s.priorityScore} /></TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell>{s.responderProfile?.unitName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(s.createdAt)}</TableCell>
                    <TableCell><div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => void open(s.id)}>Details</Button>
                      {s.status === "SUBMITTED" && <Button size="sm" onClick={() => void act(s.id, "ack")}>Acknowledge</Button>}
                      {(s.status === "SUBMITTED" || s.status === "ACKNOWLEDGED") && <Button size="sm" onClick={() => void act(s.id, "assign")}>Assign to my unit</Button>}
                      {s.status === "ASSIGNED" && s.responderProfile?.id === myId && <Button size="sm" onClick={() => void act(s.id, "start")}>Start work</Button>}
                      {s.status === "ASSIGNED" && s.responderProfile?.id === myId && <Button size="sm" variant="outline" onClick={() => void act(s.id, "release")}>Release claim</Button>}
                      {s.status === "IN_PROGRESS" && <Button size="sm" onClick={() => void act(s.id, "resolve")}>Resolve</Button>}
                    </div></TableCell>
                  </TableRow>))}
            </TableBody>
          </Table>)}
      </CardContent></Card>
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{detail?.need}</DialogTitle></DialogHeader>
          {detail && <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2"><StatusBadge status={detail.status} /><PriorityBadge level={detail.priorityLevel} score={detail.priorityScore} /></div>
            <p className="text-muted-foreground">ID <code className="font-mono">{detail.id}</code> · From {detail.citizen?.name ?? "citizen"}{detail.phone ? ` · ${detail.phone}` : ""}</p>
            {detail.details && <p>{detail.details}</p>}
            <div><p className="mb-1 font-semibold">Why this priority?</p><ul className="list-disc pl-5 text-muted-foreground">{detail.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
            {(detail.vulnerableGroups ?? []).length > 0 && <p className="text-muted-foreground">Vulnerable people: {detail.vulnerableGroups!.map((g) => titleCase(g)).join(", ")}</p>}
            <div><p className="mb-1 font-semibold">Verification &amp; duplicates</p>
              <VerificationPanel kind="sos" id={detail.id} verificationStatus={detail.verificationStatus} duplicateOfId={detail.duplicateOfId} onChanged={() => { void open(detail.id); void list.reload(); }} />
            </div>
            <div><p className="mb-1 font-semibold">Response history</p>
              {(detail.statusHistory ?? []).length === 0 ? <p className="text-muted-foreground">No history yet.</p> : (
                <ol className="space-y-1.5">{detail.statusHistory!.map((h) => <li key={h.id}><span className="font-semibold">{titleCase(h.toStatus)}</span> <span className="text-muted-foreground">· {fmtDate(h.createdAt)}{h.changedBy ? ` · ${h.changedBy.name}` : ""}{h.note ? ` — ${h.note}` : ""}</span></li>)}</ol>)}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
