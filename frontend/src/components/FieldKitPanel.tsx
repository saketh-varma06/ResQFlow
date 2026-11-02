import { useState } from "react";
import { ClipboardCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Envelope, type ListEnvelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiChecklist, type ApiFieldReport } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";

/**
 * Responder field kit (Stage E): a per-category checklist that persists on the
 * server, and structured field reports. Both are permission-checked server-side
 * (assigned unit or admin) — a 403 is shown plainly if someone else tries.
 */
export function FieldKitPanel({ kind, id }: { kind: "incidents" | "sos"; id: string }) {
  const checklist = useApi(() => api<Envelope<ApiChecklist>>(`/api/${kind}/${id}/checklist`), [id]);
  const reports = useApi(() => api<ListEnvelope<ApiFieldReport>>(`/api/${kind}/${id}/field-reports`), [id]);
  const [error, setError] = useState("");
  const [situation, setSituation] = useState("");
  const [people, setPeople] = useState("");
  const [injuries, setInjuries] = useState("");
  const [needs, setNeeds] = useState("");
  const [risks, setRisks] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle(key: string, checked: boolean) {
    const current = checklist.data?.data;
    if (!current) return;
    const keys = current.items.filter((i) => (i.key === key ? checked : i.checked)).map((i) => i.key);
    setError("");
    try { await api(`/api/${kind}/${id}/checklist`, { method: "PATCH", body: JSON.stringify({ checkedKeys: keys }) }); void checklist.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not update the checklist."); }
  }
  async function fileReport(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/${kind}/${id}/field-reports`, { method: "POST", body: JSON.stringify({ situation: situation.trim(), peopleCount: people ? Number(people) : undefined, injuriesCount: injuries ? Number(injuries) : undefined, needsSummary: needs.trim() || undefined, risks: risks.trim() || undefined }) });
      setSituation(""); setPeople(""); setInjuries(""); setNeeds(""); setRisks("");
      void reports.reload();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not file the field report."); }
    finally { setBusy(false); }
  }

  const cl = checklist.data?.data;
  return (
    <div className="space-y-4 text-sm">
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
      <div>
        <p className="flex items-center gap-2 font-semibold"><ClipboardCheck className="h-4 w-4" aria-hidden /> Field checklist{cl ? ` — ${titleCase(cl.category)}` : ""}</p>
        {checklist.loading ? <p className="mt-1 text-muted-foreground">Loading checklist…</p> : checklist.error ? <p className="mt-1 text-muted-foreground">{checklist.error}</p> : cl && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">{cl.completedCount} of {cl.totalCount} checks done{cl.updatedAt ? ` · last updated ${fmtDate(cl.updatedAt)}${cl.updatedBy ? ` by ${cl.updatedBy.name}` : ""}` : ""}</p>
            <ul className="mt-2 space-y-1.5">
              {cl.items.map((i) => (
                <li key={i.key}><label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" checked={i.checked} onChange={(e) => void toggle(i.key, e.target.checked)} />
                  <span className={i.checked ? "text-muted-foreground line-through" : ""}>{i.label}</span>
                </label></li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div>
        <p className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" aria-hidden /> Field reports</p>
        <form className="mt-2 space-y-2" onSubmit={fileReport}>
          <Textarea aria-label="Situation on the ground" placeholder="Situation on the ground — what you see, what is happening now" value={situation} onChange={(e) => setSituation(e.target.value)} required minLength={5} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min={0} aria-label="People on scene" placeholder="People on scene" value={people} onChange={(e) => setPeople(e.target.value)} />
            <Input type="number" min={0} aria-label="Injuries observed" placeholder="Injuries observed" value={injuries} onChange={(e) => setInjuries(e.target.value)} />
          </div>
          <Input aria-label="Resources needed" placeholder="Resources needed (boats, medics, pumps…)" value={needs} onChange={(e) => setNeeds(e.target.value)} />
          <Input aria-label="Risks" placeholder="Risks (rising water, unstable structure…)" value={risks} onChange={(e) => setRisks(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Filing…" : "File field report"}</Button>
        </form>
        <ul className="mt-3 space-y-2">
          {(reports.data?.data ?? []).map((r) => (
            <li key={r.id} className="rounded-md bg-slate-50 p-2.5">
              <p>{r.situation}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.author?.name ?? "Responder"} · {fmtDate(r.createdAt)}
                {r.peopleCount != null ? ` · ${r.peopleCount} people` : ""}{r.injuriesCount != null ? ` · ${r.injuriesCount} injured` : ""}
                {r.needsSummary ? ` · Needs: ${r.needsSummary}` : ""}{r.risks ? ` · Risks: ${r.risks}` : ""}
              </p>
            </li>
          ))}
          {!reports.loading && (reports.data?.data ?? []).length === 0 && <li className="text-muted-foreground">No field reports yet.</li>}
        </ul>
      </div>
    </div>
  );
}
