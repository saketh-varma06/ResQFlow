import { api, ApiError, type Envelope } from "@/lib/api";

/**
 * Offline outbox (localStorage). HONESTY RULES:
 * - A queued item has NOT reached the server. The UI must say so.
 * - An item counts as sent only when the server returns success (with its ID).
 * - Server rejections (4xx) are kept as "failed" so the user sees them — never dropped silently.
 */
export interface OutboxItem {
  id: string;
  kind: "sos" | "incident";
  payload: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  state: "queued" | "failed";
  lastError?: string;
  serverId?: string;
}
const KEY = "resqflow_outbox_v1";
export const OUTBOX_EVENT = "resqflow-outbox-changed";

export function listOutbox(): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[]; } catch { return []; }
}
function save(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}
export function enqueueOutbox(kind: OutboxItem["kind"], payload: Record<string, unknown>): OutboxItem {
  const item: OutboxItem = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, payload, queuedAt: new Date().toISOString(), attempts: 0, state: "queued" };
  save([...listOutbox(), item]);
  return item;
}
export function discardOutbox(id: string) { save(listOutbox().filter((i) => i.id !== id)); }

export interface FlushResult { sent: { kind: string; serverId: string }[]; stillQueued: number; failed: number }
let flushing = false;
export async function flushOutbox(): Promise<FlushResult> {
  const result: FlushResult = { sent: [], stillQueued: 0, failed: 0 };
  if (flushing || !navigator.onLine) { result.stillQueued = listOutbox().filter((i) => i.state === "queued").length; return result; }
  flushing = true;
  try {
    const items = listOutbox();
    const remaining: OutboxItem[] = [];
    for (const item of items) {
      if (item.state === "failed") { remaining.push(item); result.failed++; continue; }
      try {
        const path = item.kind === "sos" ? "/api/sos" : "/api/incidents";
        const res = await api<Envelope<{ id: string }>>(path, { method: "POST", body: JSON.stringify(item.payload) });
        result.sent.push({ kind: item.kind, serverId: res.data.id });
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          remaining.push({ ...item, state: "failed", attempts: item.attempts + 1, lastError: err.message });
          result.failed++;
        } else {
          remaining.push({ ...item, attempts: item.attempts + 1, lastError: err instanceof Error ? err.message : "Network error" });
          result.stillQueued++;
        }
      }
    }
    save(remaining);
    return result;
  } finally { flushing = false; }
}
