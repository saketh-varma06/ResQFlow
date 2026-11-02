import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { CAP_CATEGORIES, CAP_CERTAINTIES, CAP_URGENCIES, fmtDate, titleCase, type ApiAlert } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const AREAS = ["North District", "South District", "East District", "West District", "Central District", "All districts"];
interface Form { title: string; type: string; severity: string; area: string; instructions: string; source: string; status: string; expiresAt: string; headline: string; capCategory: string; capUrgency: string; capCertainty: string; centerLat: string; centerLng: string; radiusKm: string }
const EMPTY: Form = { title: "", type: "Weather", severity: "MODERATE", area: "North District", instructions: "", source: "District Disaster Office", status: "DRAFT", expiresAt: "", headline: "", capCategory: "Met", capUrgency: "Expected", capCertainty: "Possible", centerLat: "", centerLng: "", radiusKm: "" };

export default function AlertManagement() {
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ApiAlert | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const qs = statusFilter ? `?limit=100&status=${statusFilter}` : "?limit=100";
  const list = useApi(() => api<ListEnvelope<ApiAlert>>(`/api/alerts${qs}`), [statusFilter]);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); setError(""); }
  function openEdit(a: ApiAlert) {
    setForm({ title: a.title, type: a.type, severity: a.severity, area: a.area, instructions: a.instructions, source: a.source, status: a.status, expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "", headline: a.headline ?? "", capCategory: a.capCategory ?? "Other", capUrgency: a.capUrgency ?? "Expected", capCertainty: a.capCertainty ?? "Possible", centerLat: a.centerLat != null ? String(a.centerLat) : "", centerLng: a.centerLng != null ? String(a.centerLng) : "", radiusKm: a.radiusKm != null ? String(a.radiusKm) : "" });
    setEditing(a); setCreating(false); setError("");
  }
  async function save() {
    setError("");
    if (form.title.trim().length < 5) { setError("Title must be at least 5 characters."); return; }
    if (form.instructions.trim().length < 10) { setError("Instructions must be at least 10 characters."); return; }
    const payload = { ...form, title: form.title.trim(), instructions: form.instructions.trim(), expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      headline: form.headline.trim() || undefined,
      centerLat: form.centerLat ? Number(form.centerLat) : undefined, centerLng: form.centerLng ? Number(form.centerLng) : undefined,
      radiusKm: form.radiusKm ? Number(form.radiusKm) : undefined };
    setBusy(true);
    try {
      if (editing) await api<Envelope<ApiAlert>>(`/api/alerts/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api<Envelope<ApiAlert>>("/api/alerts", { method: "POST", body: JSON.stringify(payload) });
      setEditing(null); setCreating(false); void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Save failed."); }
    finally { setBusy(false); }
  }
  async function remove(a: ApiAlert) {
    if (!window.confirm(`Delete alert "${a.title}"?`)) return;
    try { await api(`/api/alerts/${a.id}`, { method: "DELETE" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Delete failed."); }
  }
  const open = creating || !!editing;
  return (
    <div>
      <PageHeader title="Alert management" description="Live alerts from the backend. Publishing an ACTIVE alert notifies citizens in the area and broadcasts it in realtime."
        actions={<Button onClick={openCreate}>Create alert</Button>} />
      <div className="mb-4 flex gap-3">
        <Select aria-label="Filter by status" className="w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>{["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>
      {error && !open && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table><TableHeader><TableRow><TableHead>Alert</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Reach</TableHead><TableHead>Issued</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No alerts" description="Create the first alert." /></TableCell></TableRow>
              : list.data.data.map((a) => (
                <TableRow key={a.id}><TableCell><p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.type} · {a.area} · {a.source}</p></TableCell>
                  <TableCell><SeverityBadge severity={a.severity} /></TableCell><TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>{a.reach.toLocaleString()}</TableCell><TableCell className="whitespace-nowrap">{fmtDate(a.issuedAt)}</TableCell>
                  <TableCell><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" asChild><a href={`/api/alerts/${a.id}/cap.xml`} target="_blank" rel="noreferrer">CAP XML</a></Button><Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void remove(a)}>Delete</Button></div></TableCell></TableRow>))}
          </TableBody></Table>)}
      </CardContent></Card>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editing ? "Edit alert" : "Create alert"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-title">Title</Label><Input id="a-title" value={form.title} onChange={set("title")} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-type">Type</Label><Input id="a-type" value={form.type} onChange={set("type")} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-severity">Severity</Label><Select id="a-severity" value={form.severity} onChange={set("severity")}>{["LOW", "MODERATE", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-area">Area</Label><Select id="a-area" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-status">Status</Label><Select id="a-status" value={form.status} onChange={set("status")}>{["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-source">Source</Label><Input id="a-source" value={form.source} onChange={set("source")} /></div>
            <div className="space-y-1.5"><Label htmlFor="a-exp">Expires at (optional)</Label><Input id="a-exp" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-inst">Safety instructions</Label><Textarea id="a-inst" rows={3} value={form.instructions} onChange={set("instructions")} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="a-headline">CAP headline (optional)</Label><Input id="a-headline" value={form.headline} onChange={set("headline")} placeholder="Short public headline used in the CAP feed" /></div>
            <div className="space-y-1.5"><Label htmlFor="a-capcat">CAP category</Label><Select id="a-capcat" value={form.capCategory} onChange={set("capCategory")}>{CAP_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-capurg">CAP urgency</Label><Select id="a-capurg" value={form.capUrgency} onChange={set("capUrgency")}>{CAP_URGENCIES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-capcert">CAP certainty</Label><Select id="a-capcert" value={form.capCertainty} onChange={set("capCertainty")}>{CAP_CERTAINTIES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="a-radius">Geo-target radius (km)</Label><Input id="a-radius" type="number" min={0.5} max={500} value={form.radiusKm} onChange={set("radiusKm")} placeholder="e.g. 25" /></div>
            <div className="space-y-1.5"><Label htmlFor="a-clat">Centre latitude</Label><Input id="a-clat" value={form.centerLat} onChange={set("centerLat")} placeholder="28.6139" /></div>
            <div className="space-y-1.5"><Label htmlFor="a-clng">Centre longitude</Label><Input id="a-clng" value={form.centerLng} onChange={set("centerLng")} placeholder="77.2090" /></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">CAP fields follow the OASIS Common Alerting Protocol 1.2 — the same standard India's SACHET system uses. The centre + radius drive radius subscriptions and the CAP circle. Every alert is exportable as CAP XML from the list.</p>
          {form.status === "ACTIVE" && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Saving as ACTIVE immediately notifies citizens in {form.area} and broadcasts the alert in realtime.</p>}
          {error && open && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save alert"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
