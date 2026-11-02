import webpush from "web-push";
import { PushSubscriptionModel } from "../models";

/**
 * Web Push delivery (Stage B). Configured from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
 * VAPID_SUBJECT in the environment. When keys are absent the feature disables itself
 * cleanly — in-app and realtime notifications are unaffected. Sends are best-effort:
 * dead endpoints (404/410) are pruned, failures never propagate to callers.
 */
let configured: boolean | null = null;

export function pushEnabled(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) { configured = false; return configured; }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:alerts@resqflow.local", pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function vapidPublicKey(): string | null {
  return pushEnabled() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

export async function sendPushToUsers(userIds: string[], payload: { title: string; body: string; url?: string }): Promise<void> {
  if (!pushEnabled() || userIds.length === 0) return;
  try {
    const subs = await PushSubscriptionModel.find({ userId: { $in: userIds } });
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" });
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await PushSubscriptionModel.deleteOne({ _id: s._id });
      }
    }));
  } catch { /* push is best-effort by design */ }
}
