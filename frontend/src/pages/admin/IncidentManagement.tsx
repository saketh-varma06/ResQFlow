import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type ListEnvelope } from "@/lib/api";
import { NEXT_STATUSES, WORKFLOW, fmtDate, titleCase, type ApiIncident, type ApiResponderProfile } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

export default function IncidentManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<ApiIncident | null>(null);
  const [unitId, setUnitId] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const qs = new URLSearchParams({ limit: "100" });
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);
  if (severity) qs.set("severity", severity);
  const list = useApi(() => api<ListEnvelope<ApiIncident>>(`/api/incidents?${qs.toString()}`), [search, status, severity]);
  const units = useApi(() => api<ListEnvelope<ApiResponderProfile>>("/api/responders?limit=100"));

  function openManage(i: ApiIncident) {
    setTarget(i);
    setNewStatus(i.status);
    setUnitId(i.assignments?.[0]?.responderProfile?.id ?? "");
    setError("");
  }
  async function save() {
    if (!target) return;
    setBusy(true); setError("");
    try {
      if (unitId && unitId !== (target.assignments?.[0]?.responderProfile?.id ?? "")) {
        await api(`/api/incidents/${target.id}/assign`, { method: "POST", body: JSON.stringify({ responderProfileId: unitId }) });
      }
      if (newStatus && newStatus !== target.status) {
        await api(`/api/incidents/${target.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      }
      setTarget(null);
      void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Update failed."); }
    finally { setBusy(false); }
  }
  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete incident "${title}" permanently?`)) return;
    setError("");
    try { await api(`/api/incidents/${id}`, { method: "DELETE" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Delete failed."); }
  }

  return (
    <div>
      <PageHeader title="Incident management" description="Live incidents from the backend. Assign units and move records through the validated workflow." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="min-w-56 flex-1" placeholder="Search title or location…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search incidents" />
        <Select aria-label="Filter by status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{WORKFLOW.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select aria-label="Filter by severity" className="w-40" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>{["CRITICAL", "HIGH", "MODERATE", "LOW"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Priority</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Assigned unit</TableHead><TableHead>Reported</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState title="No incidents match" description="Try clearing the filters." /></TableCell></TableRow>
                : list.data.data.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">{titleCase(i.type)} · {i.location} · by {i.reporter?.name ?? "—"}</p></TableCell>
                    <TableCell><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /></TableCell>
                    <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                    <TableCell>{i.assignments?.[0]?.responderProfile?.unitName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(i.createdAt)}</TableCell>
                    <TableCell><div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => openManage(i)}>Manage</Button>
                      <Button size="sm" variant="outline" onClick={() => void remove(i.id, i.title)}>Delete</Button>
                    </div></TableCell>
                  </TableRow>))}
            </TableBody>
          </Table>)}
      </CardContent></Card>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage incident</DialogTitle></DialogHeader>
          {target && (
            <div className="space-y-4 text-sm">
              <p className="font-semibold">{target.title}</p>
              <div><p className="mb-1 font-semibold">Why this priority? <PriorityBadge level={target.priorityLevel} score={target.priorityScore} /></p>
                <ul className="list-disc pl-5 text-muted-foreground">{target.priorityReasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
              <div className="space-y-1.5"><Label htmlFor="unit">Assign responder unit</Label>
                <Select id="unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {units.data?.data.map((u) => <option key={u.id} value={u.id}>{u.unitName} · {u.unitType} ({titleCase(u.readiness)})</option>)}
                </Select></div>
              <div className="space-y-1.5"><Label htmlFor="status">Status (workflow-validated)</Label>
                <Select id="status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value={target.status}>{titleCase(target.status)} (current)</option>
                  {(NEXT_STATUSES[target.status] ?? []).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
                <p className="text-xs text-muted-foreground">Only transitions the backend allows are offered; the server re-validates every change.</p></div>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
