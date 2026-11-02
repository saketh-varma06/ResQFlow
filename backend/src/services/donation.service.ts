import { ApiError } from "../utils/ApiError";
import { writeAudit } from "../utils/audit";
import { notifyUser, notifyUsers } from "../utils/notify";
import { out } from "./serialize";
import { DonationModel, IncidentModel, ShelterModel, UserModel, type Donation } from "../models";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createDonationSchema, listDonationsQuery, updateDonationStatusSchema } from "../validators/donation.validators";

type Doc = InstanceType<typeof DonationModel>;
const staff = (a: AuthUser) => a.role === "RESPONDER" || a.role === "ADMIN";

/** Public-safe view: anonymous donors are masked for everyone except themselves and staff. */
function view(actor: AuthUser, d: Doc) {
  const base = out(d) as unknown as Record<string, unknown>;
  if (d.anonymous && d.donorId !== actor.id && !staff(actor)) base.donorName = "Anonymous donor";
  return base;
}

async function resolveTarget(input: z.infer<typeof createDonationSchema>): Promise<{ targetId: string | null; targetLabel: string }> {
  if (input.targetType === "SHELTER") {
    const shelter = await ShelterModel.findById(input.targetId as string);
    if (!shelter) throw ApiError.notFound("Shelter not found");
    return { targetId: shelter.id, targetLabel: shelter.name };
  }
  if (input.targetType === "INCIDENT") {
    const incident = await IncidentModel.findById(input.targetId as string);
    if (!incident) throw ApiError.notFound("Incident not found");
    return { targetId: incident.id, targetLabel: incident.title };
  }
  return { targetId: null, targetLabel: "General Relief Fund" };
}

export async function createDonation(actor: AuthUser, input: z.infer<typeof createDonationSchema>, ip?: string) {
  const target = await resolveTarget(input);
  const doc = await DonationModel.create({
    donorId: actor.id, donorName: actor.name, amount: input.amount, targetType: input.targetType,
    targetId: target.targetId, targetLabel: target.targetLabel, message: input.message,
    paymentRef: input.paymentRef, anonymous: input.anonymous ?? false,
  });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "donation.create", targetType: "Donation", targetId: doc.id, details: { amount: input.amount, target: target.targetLabel }, ipAddress: ip });
  const team = await UserModel.find({ role: { $in: ["RESPONDER", "ADMIN"] }, status: "ACTIVE" }).select("_id").limit(200);
  await notifyUsers(team.map((u) => u.id), "New donation pledged", `${actor.name} pledged ₹${input.amount.toLocaleString("en-IN")} to ${target.targetLabel}. Verify the transaction reference and mark it received.`, "SYSTEM", { type: "Donation", id: doc.id });
  return view(actor, doc);
}

export async function listDonations(actor: AuthUser, q: z.infer<typeof listDonationsQuery>) {
  const page = q.page ?? 1; const limit = q.limit ?? 20;
  const filter: Record<string, unknown> = {};
  if (q.mine) {
    filter.donorId = actor.id;
    if (q.status) filter.status = q.status;
  } else if (staff(actor)) {
    if (q.status) filter.status = q.status;
  } else {
    // Citizens without ?mine get the public transparency ledger: RECEIVED only.
    filter.status = "RECEIVED";
  }
  if (q.targetType) filter.targetType = q.targetType;
  const total = await DonationModel.countDocuments(filter);
  const rows = await DonationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  return { data: rows.map((d) => view(actor, d)), page, limit, total };
}

export async function donationSummary() {
  const [receivedAgg, pledgedAgg, byTarget, recent] = await Promise.all([
    DonationModel.aggregate([{ $match: { status: "RECEIVED" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, donors: { $addToSet: "$donorId" } } }]),
    DonationModel.aggregate([{ $match: { status: "PLEDGED" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    DonationModel.aggregate([{ $match: { status: "RECEIVED" } }, { $group: { _id: "$targetLabel", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 10 }]),
    DonationModel.find({ status: "RECEIVED" }).sort({ updatedAt: -1 }).limit(5),
  ]);
  const received = receivedAgg[0] as { total: number; count: number; donors: string[] } | undefined;
  const pledged = pledgedAgg[0] as { total: number; count: number } | undefined;
  return {
    currency: "INR",
    receivedTotal: received?.total ?? 0,
    receivedCount: received?.count ?? 0,
    donorCount: received?.donors.length ?? 0,
    pledgedTotal: pledged?.total ?? 0,
    pledgedCount: pledged?.count ?? 0,
    byTarget: (byTarget as Array<{ _id: string; total: number; count: number }>).map((t) => ({ targetLabel: t._id, total: t.total, count: t.count })),
    recentReceived: recent.map((d) => ({ id: d.id, donorName: d.anonymous ? "Anonymous donor" : d.donorName, amount: d.amount, targetLabel: d.targetLabel, at: d.updatedAt })),
    note: "Only staff-verified RECEIVED donations count toward the received total. ResQFlow does not process payments; donors contribute via UPI/bank transfer outside the app and staff verify the transaction reference.",
  };
}

export async function updateDonationStatus(actor: AuthUser, id: string, input: z.infer<typeof updateDonationStatusSchema>, ip?: string) {
  const doc = await DonationModel.findById(id);
  if (!doc) throw ApiError.notFound("Donation not found");
  if (input.status === "RECEIVED" && !staff(actor)) throw ApiError.forbidden("Only responders or admins can verify a donation as received");
  if (input.status === "CANCELLED" && !staff(actor) && doc.donorId !== actor.id) throw ApiError.forbidden("You can only cancel your own donations");
  if (doc.status !== "PLEDGED") throw ApiError.badRequest(`This donation is already ${doc.status.toLowerCase()}`);
  const updated = await DonationModel.findByIdAndUpdate(id, { $set: { status: input.status, ...(input.status === "RECEIVED" ? { receivedById: actor.id } : {}) } }, { new: true });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "donation.status", targetType: "Donation", targetId: id, details: { status: input.status, amount: doc.amount }, ipAddress: ip });
  if (doc.donorId !== actor.id) {
    await notifyUser(doc.donorId, input.status === "RECEIVED" ? "Donation received — thank you" : "Donation cancelled",
      input.status === "RECEIVED"
        ? `Your donation of ₹${doc.amount.toLocaleString("en-IN")} to ${doc.targetLabel} has been verified and marked received. Thank you for helping.`
        : `Your pledged donation of ₹${doc.amount.toLocaleString("en-IN")} to ${doc.targetLabel} has been cancelled.`,
      "SYSTEM", { type: "Donation", id });
  }
  return view(actor, updated as Doc);
}
