import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiIncident, type ApiResponderProfile } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

export default function AssignedPage() {
  const [error, setError] = useState("");
  const profile = useApi(() => api<Envelope<ApiResponderProfile>>("/api/responders/me/profile"));
  const myId = profile.data?.data.id;
  const list = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=100"), []);
  const mine = (list.data?.data ?? []).filter((i) => i.assignments?.some((a) => a.responderProfile?.id === myId && !["DECLINED", "CANCELLED"].includes(a.status)));

  async function act(id: string, action: "accept" | "complete" | "decline") {
    setError("");
    try { await api(`/api/incidents/${id}/${action}`, { method: "POST" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Action failed."); }
  }
  return (
    <div>
      <PageHeader title="Assigned incidents" description="Incidents assigned to your unit by the control room. Accept to start work; complete when resolved." />
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <Card><CardContent className="p-0">
        {list.loading || profile.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Priority</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {mine.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState title="Nothing assigned" description="When the control room assigns an incident to your unit, it appears here." /></TableCell></TableRow>
                : mine.map((i) => {
                  const a = i.assignments!.find((x) => x.responderProfile?.id === myId)!;
                  return (
                    <TableRow key={i.id}>
                      <TableCell><p className="font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">{titleCase(i.type)} · {i.location}</p></TableCell>
                      <TableCell><PriorityBadge level={i.priorityLevel} score={i.priorityScore} /></TableCell>
                      <TableCell><SeverityBadge severity={i.severity} /></TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(a.assignedAt)}</TableCell>
                      <TableCell><div className="flex flex-wrap justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline"><Link to={`/responder/incidents/${i.id}`}>Open</Link></Button>
                        {a.status === "PENDING" && <><Button size="sm" onClick={() => void act(i.id, "accept")}>Accept</Button><Button size="sm" variant="outline" onClick={() => void act(i.id, "decline")}>Decline</Button></>}
                        {a.status === "ACCEPTED" && i.status === "IN_PROGRESS" && <Button size="sm" onClick={() => void act(i.id, "complete")}>Complete</Button>}
                      </div></TableCell>
                    </TableRow>);
                })}
            </TableBody>
          </Table>)}
      </CardContent></Card>
    </div>
  );
}
