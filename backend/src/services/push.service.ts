import { PushSubscriptionModel } from "../models";
import { vapidPublicKey } from "../utils/push";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { subscribePushSchema, unsubscribePushSchema } from "../validators/alert.validators";

export function pushPublicKey() {
  return { publicKey: vapidPublicKey() };
}

export async function subscribePush(actor: AuthUser, input: z.infer<typeof subscribePushSchema>) {
  const sub = await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: input.endpoint },
    { $set: { userId: actor.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent } },
    { new: true, upsert: true },
  );
  return { subscribed: true, id: sub.id };
}

export async function unsubscribePush(actor: AuthUser, input: z.infer<typeof unsubscribePushSchema>) {
  await PushSubscriptionModel.deleteOne({ endpoint: input.endpoint, userId: actor.id });
  return { subscribed: false };
}
