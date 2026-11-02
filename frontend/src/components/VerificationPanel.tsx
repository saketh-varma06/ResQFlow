import { useState } from "react";
import { ShieldCheck, CopyCheck, Undo2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/StatusBadge";
import { api, ApiError, type Envelope } from "@/lib/api";
import { fmtDate, titleCase, type ApiDuplicateCandidate } from "@/lib/apiTypes";

/**
 * Verification + duplicate review for one incident or SOS (Stage A).
 * Suggestions are deterministic (distance, area, wording, reporter) and a human
 * always confirms — nothing here merges or deletes automatically.
 */
export function VerificationPanel({ kind, id, verificationStatus, duplicateOfId, onChanged }: {
  kind: "incidents" | "sos";
  id: string;
  verificationStatus?: string;
  duplicateOfId?: string | null;
  onChanged: () => void;
}) {
  const [candidates, setCandidates] = useState<ApiDuplicateCandidate[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = kind === "incidents" ? `/api/incidents/${id}` : `/api/sos/${id}`;

  async function run(fn: () => Promise<unknown>, reloadCandidates = false) {
    setError(""); setBusy(true);
    try { await fn(); onChanged(); if (reloadCandidates) await loadCandidates(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Action failed."); }
    finally { setBusy(false); }
  }
  async function loadCandidates() {
    setError("");
    try { const r = await api<Envelope<ApiDuplicateCandidate[]>>(`${base}/duplicates`); setCandidates(r.data); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not check for duplicates."); }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge status={verificationStatus} />
        {verificationStatus === "FLAGGED_DUPLICATE" && duplicateOfId && <span className="text-muted-foreground">Merged into report <code className="font-mono">{duplicateOfId.slice(0, 8)}…</code></span>}
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {verificationStatus !== "VERIFIED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`${base}/verify`, { method: "POST" }))}><ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Mark verified</Button>}
        {verificationStatus === "FLAGGED_DUPLICATE"
          ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`${base}/unflag-duplicate`, { method: "POST" }), true)}><Undo2 className="mr-1.5 h-4 w-4" aria-hidden /> Not a duplicate</Button>
          : <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadCandidates()}><Search className="mr-1.5 h-4 w-4" aria-hidden /> Check for duplicates</Button>}
      </div>
      {candidates !== null && verificationStatus !== "FLAGGED_DUPLICATE" && (
        candidates.length === 0
          ? <p className="text-muted-foreground">No likely duplicates found (same type within 12 hours, nearby, same area or similar wording).</p>
          : <ul className="space-y-2">{candidates.map((c) => (
            <li key={c.id} className="rounded-md border p-3">
              <p className="font-semibold">{c.title ?? c.need}</p>
              <p className="text-xs text-muted-foreground">{c.location}{c.area ? ` · ${c.area}` : ""} · {titleCase(c.status)} · {fmtDate(c.createdAt)} · match score {c.matchScore}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.matchReasons.join(" · ")}</p>
              <Button size="sm" className="mt-2" disabled={busy} onClick={() => void run(() => api(`${base}/mark-duplicate`, { method: "POST", body: JSON.stringify({ duplicateOfId: c.id }) }))}><CopyCheck className="mr-1.5 h-4 w-4" aria-hidden /> Mark as duplicate of this report</Button>
            </li>))}
          </ul>
      )}
    </div>
  );
}
