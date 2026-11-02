import { useState } from "react";
import { HandHeart, PackageCheck, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { NEED_CATEGORIES, titleCase, type ApiMinimumNeeds, type ApiShelterNeed } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

/**
 * Relief logistics for one shelter (Stage D): itemised needs with live pledge
 * progress, citizen pledging, staff delivery confirmation, and the Sphere-style
 * minimum-needs estimate for the shelter's current occupancy.
 */
export function ShelterNeedsPanel({ shelterId, staff }: { shelterId: string; staff: boolean }) {
  const { user } = useAuth();
  const needs = useApi(() => api<ListEnvelope<ApiShelterNeed>>(`/api/shelters/${shelterId}/needs`), [shelterId]);
  const [days, setDays] = useState(3);
  const calc = useApi(() => api<Envelope<ApiMinimumNeeds>>(`/api/shelters/${shelterId}/minimum-needs?days=${days}`), [shelterId, days]);
  const [error, setError] = useState("");
  const [pledgeQty, setPledgeQty] = useState<Record<string, string>>({});
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("FOOD");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kits");

  async function guard(fn: () => Promise<unknown>) {
    setError("");
    try { await fn(); void needs.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Action failed."); }
  }
  const rows = needs.data?.data ?? [];
  return (
    <div className="space-y-4 text-sm">
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
      {staff && (
        <form className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void guard(async () => { await api(`/api/shelters/${shelterId}/needs`, { method: "POST", body: JSON.stringify({ item: item.trim(), category, quantityNeeded: Number(qty), unit }) }); setItem(""); setQty(""); }); }}>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor={`ni-${shelterId}`}>Item needed</Label><Input id={`ni-${shelterId}`} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Blankets" required /></div>
          <div className="space-y-1"><Label htmlFor={`nc-${shelterId}`}>Category</Label><Select id={`nc-${shelterId}`} value={category} onChange={(e) => setCategory(e.target.value)}>{NEED_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select></div>
          <div className="space-y-1"><Label htmlFor={`nq-${shelterId}`}>Quantity</Label><Input id={`nq-${shelterId}`} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor={`nu-${shelterId}`}>Unit</Label><Input id={`nu-${shelterId}`} value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
          <div className="flex items-end"><Button type="submit" className="w-full"><Plus className="mr-1.5 h-4 w-4" aria-hidden /> Post need</Button></div>
        </form>
      )}
      {needs.loading ? <p className="text-muted-foreground">Loading needs…</p>
        : rows.length === 0 ? <p className="text-muted-foreground">No relief needs posted for this shelter right now.</p>
        : rows.map((n) => {
          const pct = Math.min(100, Math.round((n.quantityPledged / Math.max(1, n.quantityNeeded)) * 100));
          return (
            <div key={n.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{n.item}</span>
                <span className="text-xs text-muted-foreground">{titleCase(n.category)}</span>
                <StatusBadge status={n.status} />
                <span className="ml-auto font-medium">{n.quantityPledged} / {n.quantityNeeded} {n.unit} pledged{n.remaining > 0 ? ` · ${n.remaining} still needed` : ""}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Pledged ${pct}%`}>
                <div className={`h-full ${n.status === "FULFILLED" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
              </div>
              {n.status === "OPEN" && (
                <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void guard(() => api(`/api/shelters/${shelterId}/needs/${n.id}/pledges`, { method: "POST", body: JSON.stringify({ quantity: Number(pledgeQty[n.id] ?? "") }) })); }}>
                  <Input type="number" min={1} max={n.remaining} className="w-28" placeholder="Qty" aria-label={`Pledge quantity of ${n.item}`} value={pledgeQty[n.id] ?? ""} onChange={(e) => setPledgeQty((q) => ({ ...q, [n.id]: e.target.value }))} required />
                  <Button size="sm" type="submit"><HandHeart className="mr-1.5 h-4 w-4" aria-hidden /> Pledge</Button>
                </form>
              )}
              {(n.pledges ?? []).length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {n.pledges!.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <span><strong className="text-foreground">{p.donorName}</strong> — {p.quantity} {n.unit} · {titleCase(p.status)}</span>
                      {staff && p.status === "PLEDGED" && <Button size="sm" variant="outline" onClick={() => void guard(() => api(`/api/shelters/pledges/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "DELIVERED" }) }))}><PackageCheck className="mr-1 h-3.5 w-3.5" aria-hidden /> Mark delivered</Button>}
                      {p.donorId === user?.id && p.status === "PLEDGED" && <Button size="sm" variant="ghost" onClick={() => void guard(() => api(`/api/shelters/pledges/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }))}><X className="mr-1 h-3.5 w-3.5" aria-hidden /> Cancel my pledge</Button>}
                    </li>
                  ))}
                </ul>
              )}
              {staff && n.status !== "CLOSED" && <Button size="sm" variant="ghost" className="mt-1" onClick={() => void guard(() => api(`/api/shelters/${shelterId}/needs/${n.id}`, { method: "PATCH", body: JSON.stringify({ status: "CLOSED" }) }))}>Close need</Button>}
            </div>
          );
        })}
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">Minimum needs estimate</p>
          <span className="text-muted-foreground">for</span>
          <Select aria-label="Estimate period in days" className="w-24" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 3, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
          </Select>
          <span className="text-muted-foreground">at current occupancy ({calc.data?.data.people ?? "…"} people)</span>
        </div>
        {calc.data && (
          <>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {calc.data.data.items.map((i) => <li key={i.key}><strong>{i.label}:</strong> {i.totalForPeriod.toLocaleString()} {i.unit} <span className="text-xs text-muted-foreground">({i.basis})</span></li>)}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{calc.data.data.assumptions.join(" ")}</p>
          </>
        )}
      </div>
    </div>
  );
}
