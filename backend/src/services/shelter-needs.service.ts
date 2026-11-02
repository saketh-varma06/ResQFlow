import { ApiError } from "../utils/ApiError";
import { writeAudit } from "../utils/audit";
import { notifyUsers } from "../utils/notify";
import { out } from "./serialize";
import { PledgeModel, ShelterModel, ShelterNeedModel, UserModel, type ShelterNeed } from "../models";
import { minimumNeeds } from "../utils/needs";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createNeedSchema, createPledgeSchema, updateNeedSchema, updatePledgeSchema } from "../validators/shelter.validators";

type NeedDoc = InstanceType<typeof ShelterNeedModel>;

async function getShelterOr404(shelterId: string) {
  const shelter = await ShelterModel.findById(shelterId);
  if (!shelter) throw ApiError.notFound("Shelter not found");
  return shelter;
}
async function getNeedOr404(shelterId: string, needId: string) {
  const need = await ShelterNeedModel.findById(needId);
  if (!need || need.shelterId !== shelterId) throw ApiError.notFound("Shelter need not found");
  return need;
}

/** Recompute the pledged aggregate + OPEN/FULFILLED status from live pledges. */
async function syncNeed(need: NeedDoc): Promise<NeedDoc> {
  const pledges = await PledgeModel.find({ needId: need.id, status: { $in: ["PLEDGED", "DELIVERED"] } });
  const total = pledges.reduce((sum, p) => sum + p.quantity, 0);
  const status = need.status === "CLOSED" ? "CLOSED" : total >= need.quantityNeeded ? "FULFILLED" : "OPEN";
  const updated = await ShelterNeedModel.findByIdAndUpdate(need.id, { $set: { quantityPledged: total, status } }, { new: true });
  return updated as NeedDoc;
}

function needView(need: NeedDoc, pledges: unknown[] | null, remaining: boolean) {
  const base = out(need) as unknown as Record<string, unknown>;
  return { ...base, remaining: Math.max(0, need.quantityNeeded - need.quantityPledged), ...(pledges ? { pledges } : {}) };
}

export async function listNeeds(actor: AuthUser, shelterId: string) {
  await getShelterOr404(shelterId);
  const needs = await ShelterNeedModel.find({ shelterId }).sort({ createdAt: -1 });
  const staff = actor.role === "RESPONDER" || actor.role === "ADMIN";
  const views = [];
  for (const need of needs) {
    const pledges = await PledgeModel.find({ needId: need.id }).sort({ createdAt: -1 });
    const visible = staff ? pledges : pledges.filter((p) => p.donorId === actor.id);
    views.push(needView(need, out(visible), true));
  }
  return views;
}

export async function createNeed(actor: AuthUser, shelterId: string, input: z.infer<typeof createNeedSchema>, ip?: string) {
  const shelter = await getShelterOr404(shelterId);
  const need = await ShelterNeedModel.create({ ...input, shelterId, createdById: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter_need.create", targetType: "ShelterNeed", targetId: need.id, details: { shelter: shelter.name, item: input.item }, ipAddress: ip });
  return needView(need, [], true);
}

export async function updateNeed(actor: AuthUser, shelterId: string, needId: string, input: z.infer<typeof updateNeedSchema>, ip?: string) {
  await getShelterOr404(shelterId);
  const need = await getNeedOr404(shelterId, needId);
  await ShelterNeedModel.findByIdAndUpdate(needId, { $set: { ...input } });
  const fresh = await ShelterNeedModel.findById(needId);
  const synced = await syncNeed(fresh as NeedDoc);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter_need.update", targetType: "ShelterNeed", targetId: needId, details: input, ipAddress: ip });
  void need;
  return needView(synced, null, true);
}

export async function deleteNeed(actor: AuthUser, shelterId: string, needId: string, ip?: string) {
  await getShelterOr404(shelterId);
  await getNeedOr404(shelterId, needId);
  await PledgeModel.deleteMany({ needId });
  await ShelterNeedModel.findByIdAndDelete(needId);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "shelter_need.delete", targetType: "ShelterNeed", targetId: needId, ipAddress: ip });
  return { deleted: true };
}

export async function createPledge(actor: AuthUser, shelterId: string, needId: string, input: z.infer<typeof createPledgeSchema>, ip?: string) {
  const shelter = await getShelterOr404(shelterId);
  const need = await getNeedOr404(shelterId, needId);
  if (need.status === "CLOSED") throw ApiError.badRequest("This need is closed and no longer accepts pledges");
  const remaining = need.quantityNeeded - need.quantityPledged;
  if (remaining <= 0) throw ApiError.badRequest("This need is already fully pledged");
  if (input.quantity > remaining) throw ApiError.badRequest(`Only ${remaining} ${need.unit} still needed — pledge at most that amount`);
  const pledge = await PledgeModel.create({ needId, shelterId, donorId: actor.id, donorName: actor.name, quantity: input.quantity, note: input.note });
  const synced = await syncNeed(need);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "pledge.create", targetType: "Pledge", targetId: pledge.id, details: { item: need.item, quantity: input.quantity }, ipAddress: ip });
  const staff = await UserModel.find({ role: { $in: ["RESPONDER", "ADMIN"] }, status: "ACTIVE" }).select("_id").limit(200);
  await notifyUsers(staff.map((u) => u.id), "New pledge for a shelter need", `${actor.name} pledged ${input.quantity} ${need.unit} of "${need.item}" for ${shelter.name}.`, "SHELTER", { type: "ShelterNeed", id: needId });
  return { pledge: out(pledge), need: needView(synced, null, true) };
}

export async function updatePledge(actor: AuthUser, pledgeId: string, input: z.infer<typeof updatePledgeSchema>, ip?: string) {
  const pledge = await PledgeModel.findById(pledgeId);
  if (!pledge) throw ApiError.notFound("Pledge not found");
  const staff = actor.role === "RESPONDER" || actor.role === "ADMIN";
  if (!staff && pledge.donorId !== actor.id) throw ApiError.forbidden("You can only change your own pledges");
  if (!staff && input.status === "DELIVERED") throw ApiError.forbidden("Only responders or admins can confirm a delivery");
  if (pledge.status !== "PLEDGED") throw ApiError.badRequest(`This pledge is already ${pledge.status.toLowerCase()}`);
  const updated = await PledgeModel.findByIdAndUpdate(pledgeId, { $set: { status: input.status } }, { new: true });
  const need = await ShelterNeedModel.findById(pledge.needId);
  if (need) await syncNeed(need);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "pledge.update", targetType: "Pledge", targetId: pledgeId, details: { status: input.status }, ipAddress: ip });
  return out(updated);
}

export async function shelterMinimumNeeds(shelterId: string, days: number) {
  const shelter = await getShelterOr404(shelterId);
  const estimate = minimumNeeds(shelter.occupied, days);
  return { shelter: { id: shelter.id, name: shelter.name, capacity: shelter.capacity, occupied: shelter.occupied }, ...estimate };
}
