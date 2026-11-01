import { useState } from "react";
import { BellRing, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingCards } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError, type ListEnvelope } from "@/lib/api";
import { fmtDate, type ApiNotification } from "@/lib/apiTypes";
import { useApi } from "@/hooks/useApi";
import { useRealtime } from "@/context/RealtimeContext";
import { useEffect } from "react";

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const list = useApi(() => api<ListEnvelope<ApiNotification>>(`/api/notifications?limit=50${unreadOnly ? "&unreadOnly=true" : ""}`), [unreadOnly]);
  const { on } = useRealtime();
  const reloadList = list.reload;
  useEffect(() => on("notification:new", () => { void reloadList(); }), [on, reloadList]);

  async function markRead(id: string) {
    try { await api(`/api/notifications/${id}/read`, { method: "PATCH" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not update the notification."); }
  }
  async function markAll() {
    try { await api("/api/notifications/read-all", { method: "POST" }); void list.reload(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not update notifications."); }
  }
  return (
    <div>
      <PageHeader title="Notifications" description="Real notifications from the backend — alerts, SOS and incident updates land here."
        actions={<Button variant="outline" onClick={() => void markAll()}><CheckCheck className="mr-1.5 h-4 w-4" aria-hidden /> Mark all read</Button>} />
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={!unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(false)}>All</Button>
        <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(true)}>Unread only</Button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      {list.loading ? <LoadingCards count={3} /> : list.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{list.error}</p>
        : !list.data || list.data.data.length === 0 ? <EmptyState title="No notifications" description={unreadOnly ? "You have no unread notifications." : "Notifications will appear here as events happen."} />
        : <div className="space-y-3">{list.data.data.map((n) => (
          <Card key={n.id} className={n.isRead ? "" : "border-red-200 bg-red-50/40"}><CardContent className="flex items-start gap-3 py-4">
            <BellRing className={`mt-0.5 h-5 w-5 shrink-0 ${n.isRead ? "text-slate-400" : "text-red-600"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{n.title} {!n.isRead && <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">New</span>}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtDate(n.createdAt)}</p>
            </div>
            {!n.isRead && <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>Mark read</Button>}
          </CardContent></Card>))}
        </div>}
    </div>
  );
}
