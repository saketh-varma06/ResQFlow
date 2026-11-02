import { useState } from "react";
import { BadgeIndianRupee, HandHeart, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiDonation, type ApiDonationSummary, type ApiIncident, type ApiShelter } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Monetary donations (Stage H). Honest design: ResQFlow does not process payments —
 * you contribute by UPI/bank transfer outside the app, record it here with the
 * transaction reference, and the response team verifies it before it counts in the
 * public totals. Nothing is shown as "received" until a human verifies it.
 */
export default function DonationsPage() {
  const summary = useApi(() => api<Envelope<ApiDonationSummary>>("/api/donations/summary"));
  const mine = useApi(() => api<ListEnvelope<ApiDonation>>("/api/donations?mine=true&limit=50"));
  const ledger = useApi(() => api<ListEnvelope<ApiDonation>>("/api/donations?limit=10"));
  const shelters = useApi(() => api<ListEnvelope<ApiShelter>>("/api/shelters?limit=100"));
  const incidents = useApi(() => api<ListEnvelope<ApiIncident>>("/api/incidents?limit=50"));
  const [amount, setAmount] = useState("");
  const [targetType, setTargetType] = useState("GENERAL");
  const [targetId, setTargetId] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const s = summary.data?.data;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setDone("");
    try {
      const r = await api<Envelope<ApiDonation>>("/api/donations", { method: "POST", body: JSON.stringify({ amount: Number(amount), targetType, targetId: targetType === "GENERAL" ? undefined : targetId, paymentRef: paymentRef.trim() || undefined, message: message.trim() || undefined, anonymous }) });
      setDone(`Thank you — your ${inr(r.data.amount)} donation to ${r.data.targetLabel} is recorded as pledged. It will appear in the public totals once the response team verifies your transaction reference.`);
      setAmount(""); setPaymentRef(""); setMessage(""); setTargetId("");
      void mine.reload(); void summary.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not record the donation."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setError("");
    try { await api(`/api/donations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }); void mine.reload(); void summary.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not cancel."); }
  }

  return (
    <div>
      <PageHeader title="Donate to relief" description="Money donations for the relief fund, a specific shelter, or an incident response — verified by the response team before they count." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Verified received" value={s ? inr(s.receivedTotal) : "—"} sub={s ? `${s.receivedCount} donations from ${s.donorCount} donors` : ""} icon={BadgeIndianRupee} tone="green" />
        <StatCard label="Pledged (awaiting verification)" value={s ? inr(s.pledgedTotal) : "—"} sub={s ? `${s.pledgedCount} pledges` : ""} icon={HandHeart} tone="amber" />
        <StatCard label="How it works" value="Verified by humans" sub="No payment is processed inside this app" icon={ShieldCheck} tone="sky" />
      </div>
      <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">Contribute by UPI or bank transfer to the relief collection account shared by the response team, then record it here with the transaction reference. The team verifies the reference and marks it received — only then does it enter the public totals below.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Record a donation</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
              {done && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{done}</p>}
              <div className="space-y-1.5"><Label htmlFor="dn-amount">Amount (₹)</Label><Input id="dn-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="1000" /></div>
              <div className="space-y-1.5"><Label htmlFor="dn-target">Donate to</Label>
                <Select id="dn-target" value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(""); }}>
                  <option value="GENERAL">General Relief Fund</option>
                  <option value="SHELTER">A specific shelter</option>
                  <option value="INCIDENT">A specific incident</option>
                </Select></div>
              {targetType === "SHELTER" && <div className="space-y-1.5"><Label htmlFor="dn-shelter">Shelter</Label>
                <Select id="dn-shelter" value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
                  <option value="">Choose a shelter…</option>
                  {(shelters.data?.data ?? []).map((sh) => <option key={sh.id} value={sh.id}>{sh.name} — {sh.area}</option>)}
                </Select></div>}
              {targetType === "INCIDENT" && <div className="space-y-1.5"><Label htmlFor="dn-incident">Incident</Label>
                <Select id="dn-incident" value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
                  <option value="">Choose an incident…</option>
                  {(incidents.data?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.title} — {i.area}</option>)}
                </Select></div>}
              <div className="space-y-1.5"><Label htmlFor="dn-ref">UPI / bank transaction reference (helps verification)</Label><Input id="dn-ref" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. UPI transaction ID" /></div>
              <div className="space-y-1.5"><Label htmlFor="dn-msg">Message (optional)</Label><Input id="dn-msg" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Donate anonymously (name hidden in the public ledger)</label>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Recording…" : "Record donation"}</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-lg font-bold">My donations</h2>
            {mine.loading ? <LoadingCards count={2} /> : (mine.data?.data ?? []).length === 0
              ? <EmptyState title="No donations yet" description="Donations you record will appear here with their verification status." />
              : <div className="space-y-2">{(mine.data?.data ?? []).map((d) => (
                <Card key={d.id}><CardContent className="flex flex-wrap items-center gap-2 py-3">
                  <span className="font-display font-bold">{inr(d.amount)}</span>
                  <span className="text-sm text-muted-foreground">to {d.targetLabel}</span>
                  <StatusBadge status={d.status} />
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(d.createdAt)}</span>
                  {d.status === "PLEDGED" && <Button size="sm" variant="ghost" onClick={() => void cancel(d.id)}><X className="mr-1 h-3.5 w-3.5" aria-hidden /> Cancel</Button>}
                </CardContent></Card>))}
              </div>}
          </div>
          <div>
            <h2 className="mb-3 font-display text-lg font-bold">Public ledger — verified donations</h2>
            {(ledger.data?.data ?? []).length === 0
              ? <EmptyState title="No verified donations yet" description="Verified donations will be listed here for full transparency." />
              : <ul className="space-y-2">{(ledger.data?.data ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-semibold">{d.donorName}</span><span className="text-muted-foreground">donated</span>
                  <span className="font-display font-bold">{inr(d.amount)}</span><span className="text-muted-foreground">to {d.targetLabel}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(d.createdAt)}</span>
                </li>))}
              </ul>}
            {s && s.byTarget.length > 0 && <p className="mt-3 text-sm text-muted-foreground">By destination: {s.byTarget.map((t) => `${t.targetLabel} ${inr(t.total)}`).join(" · ")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
