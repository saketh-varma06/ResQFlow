import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiAudit } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const PAGE = 25;
export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ limit: String(PAGE), page: String(page) });
  if (action) qs.set("action", action);
  if (actor) qs.set("actorEmail", actor);
  const list = useApi(() => api<ListEnvelope<ApiAudit>>(`/api/audit-logs?${qs.toString()}`), [action, actor, page]);
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.meta.total / PAGE)) : 1;
  return (
    <div>
      <PageHeader title="Audit logs" description="Every important action recorded by the backend — logins, status changes, assignments, management actions." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Filter by action" className="w-52" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {["auth.login", "auth.logout", "auth.register", "incident.create", "incident.assign", "incident.status_change", "sos.create", "sos.assign", "sos.status_change", "alert.create", "shelter.create", "shelter.update", "user.update", "responder.create"].map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
        <Input className="min-w-56 flex-1" placeholder="Filter by actor email…" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} aria-label="Filter by actor email" />
      </div>
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Result</TableHead><TableHead>IP</TableHead></TableRow></TableHeader><TableBody>
            {!list.data || list.data.data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="No audit entries match" /></TableCell></TableRow>
              : list.data.data.map((a) => (
                <TableRow key={a.id}><TableCell className="whitespace-nowrap">{fmtDate(a.createdAt)}</TableCell>
                  <TableCell>{a.actorEmail ?? "system"}</TableCell><TableCell className="font-mono text-xs">{a.action}</TableCell>
                  <TableCell>{a.targetType}{a.targetId ? <span className="block max-w-40 truncate font-mono text-xs text-muted-foreground">{a.targetId}</span> : null}</TableCell>
                  <TableCell><StatusBadge status={a.result} /></TableCell><TableCell className="font-mono text-xs">{a.ipAddress ?? "—"}</TableCell></TableRow>))}
          </TableBody></Table>)}
      </CardContent></Card>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span>Page {page} of {totalPages} · {list.data?.meta.total ?? 0} entries</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
