import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { titleCase, type ApiResponderProfile } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const READINESS = ["AVAILABLE", "DEPLOYED", "STANDBY", "OFF_DUTY"];
interface CreateForm { email: string; name: string; password: string; unitName: string; unitType: string; base: string; members: number; serviceArea: string }
const EMPTY: CreateForm = { email: "", name: "", password: "", unitName: "", unitType: "Rescue", base: "", members: 4, serviceArea: "" };

export default function ResponderManagement() {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApiResponderProfile | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const list = useApi(() => api<ListEnvelope<ApiResponderProfile>>("/api/responders?limit=100"));
  const set = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  async function create() {
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api<Envelope<ApiResponderProfile>>("/api/responders", { method: "POST", body: JSON.stringify({ ...form, serviceArea: form.serviceArea || undefined }) });
      setCreating(false); setForm(EMPTY); void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Create failed."); }
    finally { setBusy(false); }
  }
  async function saveEdit() {
    if (!editing) return;
    setError(""); setBusy(true);
    try {
      await api<Envelope<ApiResponderProfile>>(`/api/responders/${editing.id}`, { method: "PATCH", body: JSON.stringify({ unitName: editing.unitName, unitType: editing.unitType, base: editing.base, members: editing.members, readiness: editing.readiness, serviceArea: editing.serviceArea ?? undefined }) });
      setEditing(null); void list.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Save failed."); }
    finally { setBusy(false); }
  }
  async function remove(u: ApiResponderProfile) {
    if (!window.confirm(`Delete responder unit "${u.unitName}"? The linked user account is kept.`)) return;
    try { await api(`/api/responders/${u.id}`, { method: "DELETE" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Delete failed."); }
  }
  return (
    <div>
      <PageHeader title="Responder management" description="Live responder units from the backend. Creating a unit also creates its login account (active immediately, created by an admin)."
        actions={<Button onClick={() => { setForm(EMPTY); setCreating(true); setError(""); }}>Add responder unit</Button>} />
      {error && !creating && !editing && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table><TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Lead account</TableHead><TableHead>Readiness</TableHead><TableHead>Members</TableHead><TableHead>Base</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No responder units" /></TableCell></TableRow>
              : list.data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="font-semibold">{u.unitName}</p><p className="text-xs text-muted-foreground">{u.unitType}{u.serviceArea ? ` · ${u.serviceArea}` : ""}</p></TableCell>
                  <TableCell>{u.user?.name ?? "—"}<p className="text-xs text-muted-foreground">{u.user?.email ?? ""}</p></TableCell>
                  <TableCell><StatusBadge status={u.readiness} /></TableCell>
                  <TableCell>{u.members}</TableCell><TableCell>{u.base}</TableCell>
                  <TableCell><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => { setEditing(u); setError(""); }}>Edit</Button><Button size="sm" variant="outline" onClick={() => void remove(u)}>Delete</Button></div></TableCell>
                </TableRow>))}
          </TableBody></Table>)}
      </CardContent></Card>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) setCreating(false); }}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Add responder unit</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="r-unit">Unit name</Label><Input id="r-unit" value={form.unitName} onChange={set("unitName")} placeholder="River Rescue 12" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-type">Unit type</Label><Input id="r-type" value={form.unitType} onChange={set("unitType")} placeholder="Rescue / Fire / Medical…" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-name">Lead name</Label><Input id="r-name" value={form.name} onChange={set("name")} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-email">Lead email (login)</Label><Input id="r-email" type="email" value={form.email} onChange={set("email")} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-pass">Initial password</Label><Input id="r-pass" type="password" value={form.password} onChange={set("password")} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-members">Members</Label><Input id="r-members" type="number" min={1} value={form.members} onChange={set("members")} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-base">Base</Label><Input id="r-base" value={form.base} onChange={set("base")} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-area">Service area (optional)</Label><Input id="r-area" value={form.serviceArea} onChange={set("serviceArea")} /></div>
          </div>
          {error && creating && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={() => void create()} disabled={busy}>{busy ? "Creating…" : "Create unit"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Edit unit</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="e-unit">Unit name</Label><Input id="e-unit" value={editing.unitName} onChange={(e) => setEditing({ ...editing, unitName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-type">Unit type</Label><Input id="e-type" value={editing.unitType} onChange={(e) => setEditing({ ...editing, unitType: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-base">Base</Label><Input id="e-base" value={editing.base} onChange={(e) => setEditing({ ...editing, base: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-members">Members</Label><Input id="e-members" type="number" min={1} value={editing.members} onChange={(e) => setEditing({ ...editing, members: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label htmlFor="e-ready">Readiness</Label><Select id="e-ready" value={editing.readiness} onChange={(e) => setEditing({ ...editing, readiness: e.target.value })}>{READINESS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select></div>
              <div className="space-y-1.5"><Label htmlFor="e-area">Service area</Label><Input id="e-area" value={editing.serviceArea ?? ""} onChange={(e) => setEditing({ ...editing, serviceArea: e.target.value })} /></div>
            </div>
          )}
          {error && editing && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
