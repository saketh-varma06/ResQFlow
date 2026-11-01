import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { discardOutbox, flushOutbox, listOutbox, OUTBOX_EVENT, type OutboxItem } from "@/lib/outbox";

/**
 * Offline status + outbox indicator. Queued items are described as
 * NOT received by the server — only a completed flush confirms receipt.
 */
export default function OutboxBar() {
  const { user } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<OutboxItem[]>(() => listOutbox());
  const [sentNote, setSentNote] = useState<string>("");
  const [flushingNow, setFlushingNow] = useState(false);

  const refresh = useCallback(() => setItems(listOutbox()), []);
  const flush = useCallback(async () => {
    setFlushingNow(true);
    try {
      const r = await flushOutbox();
      if (r.sent.length) {
        setSentNote(r.sent.map((s) => `${s.kind === "sos" ? "SOS" : "Incident report"} received by the server — ID ${s.serverId}`).join(" · "));
        window.setTimeout(() => setSentNote(""), 12000);
      }
    } finally { setFlushingNow(false); refresh(); }
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(OUTBOX_EVENT, refresh);
    window.addEventListener("online", flush);
    return () => { window.removeEventListener(OUTBOX_EVENT, refresh); window.removeEventListener("online", flush); };
  }, [refresh, flush]);
  useEffect(() => { if (user && online) void flush(); }, [user, online, flush]);

  if (!user) return null;
  const queued = items.filter((i) => i.state === "queued");
  const failed = items.filter((i) => i.state === "failed");
  if (online && queued.length === 0 && failed.length === 0 && !sentNote) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[100] w-80 space-y-2" aria-live="polite">
      {sentNote && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-lift">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p>{sentNote}</p>
        </div>
      )}
      {!online && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-lift">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p><strong>You are offline.</strong> Pages and maps may be out of date. {queued.length > 0 ? `${queued.length} request(s) are saved on this device only — they have NOT reached the server.` : "New SOS requests will be saved on this device until you reconnect."} In an emergency, call <strong>112</strong>.</p>
        </div>
      )}
      {queued.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-white p-3 text-sm shadow-lift">
          <p className="font-semibold">{queued.length} request(s) waiting to send</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Saved on this device at {queued.map((q) => new Date(q.queuedAt).toLocaleTimeString()).join(", ")}. Not yet received by the server{online ? " — sending will retry automatically." : " — will send when you are back online."}</p>
          {online && <button type="button" onClick={() => void flush()} disabled={flushingNow} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"><RefreshCw className="h-3.5 w-3.5" aria-hidden />{flushingNow ? "Sending…" : "Retry now"}</button>}
        </div>
      )}
      {failed.map((f) => (
        <div key={f.id} className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 shadow-lift">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">A queued {f.kind === "sos" ? "SOS" : "incident report"} was <strong>rejected by the server</strong> ({f.lastError ?? "error"}) and was not accepted. Please submit it again from the {f.kind === "sos" ? "SOS" : "Report"} page.</p>
          <button type="button" aria-label="Dismiss failed request" onClick={() => discardOutbox(f.id)} className="rounded p-0.5 hover:bg-red-100"><Trash2 className="h-4 w-4" aria-hidden /></button>
        </div>
      ))}
    </div>
  );
}
