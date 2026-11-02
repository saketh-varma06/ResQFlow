import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { MISSING_PERSON_STATUSES, fmtDate, titleCase, type ApiMissingPerson } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

/**
 * Tracing-team registry (Stage G) — staff only. This list is never public:
 * citizens see only their own reports. Contact numbers appear here because
 * reunification requires calling the family.
 */
export default function MissingPersonsRegistryPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = useApi(() => api<ListEnvelope<ApiMissingPerson>>(`/api/missing-persons?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`), [q, status]);
  const [selected, setSelected] = useState<ApiMissingPerson | null>(null);
  const [newStatus, setNewStatus] = useState("SEARCHING");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const r = await api<Envelope<ApiMissingPerson>>(`/api/missing-persons/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus, resolutionNote: note.trim() || undefined }) });
      setSelected(r.data);
      void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Update failed."); }
    finally { setBusy(false); }
  }

  const rows = list.data?.data ?? [];
  return (
    <div>
      <PageHeader title="Missing persons registry" description="Family-tracing work list. Staff access only — never share this list publicly; contact details are for reunification calls." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search missing persons by name" /></div>
        <Select aria-label="Filter by status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {MISSING_PERSON_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Missing person</TableHead><TableHead>Last seen</TableHead><TableHead>Status</TableHead><TableHead>Reporter (contact)</TableHead><TableHead>Filed</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No reports" description="No missing-person reports match this view." /></TableCell></TableRow>
                : rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><p className="font-semibold">{p.fullName}</p><p className="text-xs text-muted-foreground">{p.ageApprox ? `Age ~${p.ageApprox}` : ""}{p.gender ? ` · ${p.gender}` : ""}</p></TableCell>
                    <TableCell className="text-sm">{p.lastSeenLocation}{p.area ? <span className="text-muted-foreground"> · {p.area}</span> : ""}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-sm">{p.reporter?.name ?? "—"} ({p.reporterRelationship})<br /><span className="text-muted-foreground">{p.reporterPhone}</span></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(p.createdAt)}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(p); setNewStatus(p.status === "REPORTED" ? "SEARCHING" : p.status); setNote(p.resolutionNote ?? ""); setError(""); }}>Work case</Button></TableCell>
                  </TableRow>))}
            </TableBody>
          </Table>)}
      </CardContent></Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{selected?.fullName}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
              <p><strong>Last seen:</strong> {selected.lastSeenLocation}{selected.area ? `, ${selected.area}` : ""}{selected.lastSeenAt ? ` · ${fmtDate(selected.lastSeenAt)}` : ""}</p>
              {selected.description && <p><strong>Description:</strong> {selected.description}</p>}
              {selected.circumstances && <p><strong>Circumstances:</strong> {selected.circumstances}</p>}
              <p><strong>Reporter:</strong> {selected.reporter?.name ?? "Citizen"} ({selected.reporterRelationship}) · <strong>{selected.reporterPhone}</strong></p>
              <div className="space-y-1.5"><Label htmlFor="mp-status">Search status</Label>
                <Select id="mp-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {MISSING_PERSON_STATUSES.filter((s) => s !== "REPORTED").map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select></div>
              <div className="space-y-1.5"><Label htmlFor="mp-note">Resolution / progress note (the reporter sees this)</Label>
                <Textarea id="mp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required when marking as found — where/how located, family informed…" /></div>
              <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save update & notify reporter"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
