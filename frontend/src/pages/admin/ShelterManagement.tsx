import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { ShelterNeedsPanel } from "@/components/ShelterNeedsPanel";
import { fmtDate, type ApiShelter } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

interface FormState { name: string; address: string; area: string; capacity: number; occupied: number; facilities: string; accessibility: string; contact: string; latitude: string; longitude: string }
const EMPTY: FormState = { name: "", address: "", area: "North District", capacity: 100, occupied: 0, facilities: "", accessibility: "", contact: "", latitude: "", longitude: "" };
const AREAS = ["North District", "South District", "East District", "West District", "Central District"];

export default function ShelterManagement() {
  const [needsFor, setNeedsFor] = useState<ApiShelter | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ApiShelter | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const list = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=100"));

  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); setError(""); }
  function openEdit(s: ApiShelter) {
    setForm({ name: s.name, address: s.address, area: s.area, capacity: s.capacity, occupied: s.occupied, facilities: s.facilities.join(", "), accessibility: s.accessibility ?? "", contact: s.contact ?? "", latitude: s.latitude?.toString() ?? "", longitude: s.longitude?.toString() ?? "" });
    setEditing(s); setCreating(false); setError("");
  }
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setError("");
    if (form.name.trim().length < 3) { setError("Name must be at least 3 characters."); return; }
    if (Number(form.capacity) < 1) { setError("Capacity must be at least 1."); return; }
    if (Number(form.occupied) > Number(form.capacity)) { setError("Occupied cannot exceed capacity — the server will reject this too."); return; }
    const payload = {
      name: form.name.trim(), address: form.address.trim(), area: form.area,
      capacity: Number(form.capacity), occupied: Number(form.occupied),
      facilities: form.facilities.split(",").map((x) => x.trim()).filter(Boolean),
      accessibility: form.accessibility.trim() || undefined, contact: form.contact.trim() || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined,
    };
    setBusy(true);
    try {
      if (editing) await api<Envelope<ApiShelter>>(`/api/shelters/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api<Envelope<ApiShelter>>("/api/shelters", { method: "POST", body: JSON.stringify(payload) });
      setEditing(null); setCreating(false);
      void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Save failed."); }
    finally { setBusy(false); }
  }
  async function remove(s: ApiShelter) {
    if (!window.confirm(`Delete shelter "${s.name}" permanently?`)) return;
    setError("");
    try { await api(`/api/shelters/${s.id}`, { method: "DELETE" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Delete failed."); }
  }

  const dialogOpen = creating || !!editing;
  return (
    <div>
      <PageHeader title="Shelter management" description="Live shelter records. Operational status (OPEN / NEARLY_FULL / FULL) is derived from occupancy on the server; invalid capacity updates are rejected."
        actions={<Button onClick={openCreate}>Add shelter</Button>} />
      {error && !dialogOpen && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Shelter</TableHead><TableHead>Status</TableHead><TableHead>Capacity</TableHead><TableHead>Available</TableHead><TableHead>Accessibility</TableHead><TableHead>Last updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState title="No shelters" description="Add the first shelter to get started." /></TableCell></TableRow>
                : list.data.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.address} · {s.area}{s.latitude && s.longitude ? ` · ${s.latitude}, ${s.longitude}` : ""}</p></TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell>{s.occupied} / {s.capacity}</TableCell>
                    <TableCell className="font-semibold">{s.available}</TableCell>
                    <TableCell className="max-w-56 text-xs text-muted-foreground">{s.accessibility ?? "Not recorded"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(s.updatedAt)}</TableCell>
                    <TableCell><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => setNeedsFor(s)}>Needs</Button><Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void remove(s)}>Delete</Button></div></TableCell>
                  </TableRow>))}
            </TableBody>
          </Table>)}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit shelter" : "Add shelter"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-name">Shelter name</Label><Input id="s-name" value={form.name} onChange={set("name")} required /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-address">Address</Label><Input id="s-address" value={form.address} onChange={set("address")} required /></div>
            <div className="space-y-1.5"><Label htmlFor="s-area">District</Label>
              <select id="s-area" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="s-contact">Contact (optional)</Label><Input id="s-contact" value={form.contact} onChange={set("contact")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-capacity">Total capacity</Label><Input id="s-capacity" type="number" min={1} value={form.capacity} onChange={set("capacity")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-occupied">Currently occupied</Label><Input id="s-occupied" type="number" min={0} value={form.occupied} onChange={set("occupied")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-lat">Latitude (optional)</Label><Input id="s-lat" inputMode="decimal" value={form.latitude} onChange={set("latitude")} placeholder="28.638" /></div>
            <div className="space-y-1.5"><Label htmlFor="s-lng">Longitude (optional)</Label><Input id="s-lng" inputMode="decimal" value={form.longitude} onChange={set("longitude")} placeholder="77.222" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-facilities">Facilities (comma separated)</Label><Input id="s-facilities" value={form.facilities} onChange={set("facilities")} placeholder="Beds, Food, Medical desk" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-access">Accessibility details</Label><Textarea id="s-access" rows={2} value={form.accessibility} onChange={set("accessibility")} placeholder="Step-free entrance, accessible toilets, ground-floor beds…" /></div>
          </div>
          {error && dialogOpen && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save shelter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!needsFor} onOpenChange={(o) => { if (!o) setNeedsFor(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Relief needs — {needsFor?.name}</DialogTitle></DialogHeader>
          {needsFor && <ShelterNeedsPanel shelterId={needsFor.id} staff />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
