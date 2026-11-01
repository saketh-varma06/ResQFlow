import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiUser } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

export default function UserManagement() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const qs = new URLSearchParams({ limit: "100" });
  if (search) qs.set("search", search);
  if (role) qs.set("role", role);
  if (status) qs.set("status", status);
  const list = useApi(() => api<ListEnvelope<ApiUser>>(`/api/users?${qs.toString()}`), [search, role, status]);

  async function patch(id: string, body: Record<string, string>) {
    setError("");
    try { await api<Envelope<ApiUser>>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Update failed."); }
  }
  async function remove(u: ApiUser) {
    if (!window.confirm(`Delete user ${u.name} (${u.email})? This cannot be undone.`)) return;
    setError("");
    try { await api(`/api/users/${u.id}`, { method: "DELETE" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Delete failed."); }
  }
  return (
    <div>
      <PageHeader title="User management" description="Live accounts from the backend. Activating a PENDING responder/admin is how elevated accounts get approved." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="min-w-56 flex-1" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        <Select aria-label="Filter by role" className="w-40" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{["CITIZEN", "RESPONDER", "ADMIN"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </Select>
        <Select aria-label="Filter by status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{["ACTIVE", "PENDING", "SUSPENDED"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Area</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No users match" /></TableCell></TableRow>
              : list.data.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="font-semibold">{u.name}{u.id === me?.id ? " (you)" : ""}</p><p className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ""}{u.responderProfile ? ` · ${u.responderProfile.unitName}` : ""}</p></TableCell>
                  <TableCell>
                    <Select aria-label={`Role for ${u.name}`} className="w-32" value={u.role} disabled={u.id === me?.id} onChange={(e) => void patch(u.id, { role: e.target.value })}>
                      {["CITIZEN", "RESPONDER", "ADMIN"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell>{u.area ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell><div className="flex flex-wrap justify-end gap-1.5">
                    {u.status === "PENDING" && <Button size="sm" onClick={() => void patch(u.id, { status: "ACTIVE" })}>Approve</Button>}
                    {u.status === "ACTIVE" && u.id !== me?.id && <Button size="sm" variant="outline" onClick={() => void patch(u.id, { status: "SUSPENDED" })}>Suspend</Button>}
                    {u.status === "SUSPENDED" && <Button size="sm" variant="outline" onClick={() => void patch(u.id, { status: "ACTIVE" })}>Reactivate</Button>}
                    {u.id !== me?.id && <Button size="sm" variant="outline" onClick={() => void remove(u)}>Delete</Button>}
                  </div></TableCell>
                </TableRow>))}
          </TableBody></Table>)}
      </CardContent></Card>
    </div>
  );
}
