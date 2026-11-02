import { useState } from "react";
import { BadgeCheck, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiDonation, type ApiDonationSummary } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Donation verification desk (Stage H): pledges become RECEIVED only here,
 *  after a human checks the transaction reference against the collection account. */
export default function DonationsManagement() {
  const [status, setStatus] = useState("PLEDGED");
  const summary = useApi(() => api<Envelope<ApiDonationSummary>>("/api/donations/summary"));
  const list = useApi(() => api<ListEnvelope<ApiDonation>>(`/api/donations?limit=100${status ? `&status=${status}` : ""}`), [status]);
  const [error, setError] = useState("");
  const s = summary.data?.data;

  async function setDonationStatus(id: string, next: string) {
    setError("");
    try { await api(`/api/donations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); void list.reload(); void summary.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Update failed."); }
  }
  const rows = list.data?.data ?? [];
  return (
    <div>
      <PageHeader title="Donations" description="Verify pledged donations against their transaction references. Only verified donations enter the public totals." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Verified received" value={s ? inr(s.receivedTotal) : "—"} sub={s ? `${s.receivedCount} donations · ${s.donorCount} donors` : ""} icon={BadgeCheck} tone="green" />
        <StatCard label="Awaiting verification" value={s ? inr(s.pledgedTotal) : "—"} sub={s ? `${s.pledgedCount} pledges` : ""} icon={BadgeCheck} tone="amber" />
        <StatCard label="Top destination" value={s?.byTarget[0]?.targetLabel ?? "—"} sub={s?.byTarget[0] ? inr(s.byTarget[0].total) : ""} icon={BadgeCheck} tone="sky" />
      </div>
      {error && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="mb-4 flex items-center gap-3">
        <Select aria-label="Filter by status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PLEDGED">Awaiting verification</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="">All donations</option>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        {list.loading ? <div className="p-4"><LoadingCards count={3} /></div> : list.error ? <p role="alert" className="p-4 text-sm text-red-700">{list.error}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Donor</TableHead><TableHead>Amount</TableHead><TableHead>Destination</TableHead><TableHead>Transaction ref</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState title="No donations in this view" description="Donations matching this status will appear here." /></TableCell></TableRow>
                : rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><p className="font-semibold">{d.donorName}</p>{d.message && <p className="text-xs text-muted-foreground">“{d.message}”</p>}</TableCell>
                    <TableCell className="font-semibold">{inr(d.amount)}</TableCell>
                    <TableCell className="text-sm">{d.targetLabel}</TableCell>
                    <TableCell className="text-sm">{d.paymentRef ?? <span className="text-muted-foreground">Not provided</span>}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(d.createdAt)}</TableCell>
                    <TableCell className="text-right">{d.status === "PLEDGED" && <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => void setDonationStatus(d.id, "RECEIVED")}><BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden /> Mark received</Button>
                      <Button size="sm" variant="outline" onClick={() => void setDonationStatus(d.id, "CANCELLED")}><X className="mr-1 h-3.5 w-3.5" aria-hidden /> Reject</Button>
                    </div>}</TableCell>
                  </TableRow>))}
            </TableBody>
          </Table>)}
      </CardContent></Card>
    </div>
  );
}
