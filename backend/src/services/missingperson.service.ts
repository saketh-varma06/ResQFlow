import { ApiError } from "../utils/ApiError";
import { writeAudit } from "../utils/audit";
import { notifyUser } from "../utils/notify";
import { out } from "./serialize";
import { MissingPersonModel, type MissingPerson } from "../models";
import type { AuthUser } from "../types/auth";
import type { z } from "zod";
import type { createMissingPersonSchema, listMissingPersonsQuery, updateMissingPersonStatusSchema } from "../validators/missingperson.validators";

type Doc = InstanceType<typeof MissingPersonModel>;
const staff = (a: AuthUser) => a.role === "RESPONDER" || a.role === "ADMIN";

/** Full record — only ever returned to the reporter or to staff. */
const full = (d: Doc) => out(d);
export async function createReport(actor: AuthUser, input: z.infer<typeof createMissingPersonSchema>, ip?: string) {
  const doc = await MissingPersonModel.create({ ...input, reporterId: actor.id });
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "missing_person.create", targetType: "MissingPerson", targetId: doc.id, ipAddress: ip });
  return full(doc);
}

export async function listReports(actor: AuthUser, q: z.infer<typeof listMissingPersonsQuery>) {
  // Privacy rule: citizens can only ever list their own reports. Staff get the registry.
  if (!staff(actor)) {
    const rows = await MissingPersonModel.find({ reporterId: actor.id }).sort({ createdAt: -1 }).limit(100);
    return { data: out(rows), page: 1, limit: rows.length, total: rows.length };
  }
  const filter: Record<string, unknown> = {};
  if (q.mine) filter.reporterId = actor.id;
  if (q.status) filter.status = q.status;
  if (q.area) filter.area = q.area;
  if (q.q) filter.fullName = { $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const total = await MissingPersonModel.countDocuments(filter);
  const page = q.page ?? 1; const limit = q.limit ?? 20;
  const rows = await MissingPersonModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("reporter", "name email");
  return { data: out(rows), page, limit, total };
}

export async function getReport(actor: AuthUser, id: string) {
  const doc = await MissingPersonModel.findById(id).populate("reporter", "name email");
  // 404 (not 403) for other citizens: the registry must not confirm a report exists.
  if (!doc || (!staff(actor) && doc.reporterId !== actor.id)) throw ApiError.notFound("Missing person report not found");
  return out(doc);
}

export async function updateStatus(actor: AuthUser, id: string, input: z.infer<typeof updateMissingPersonStatusSchema>, ip?: string) {
  const doc = await MissingPersonModel.findById(id);
  if (!doc) throw ApiError.notFound("Missing person report not found");
  if ((input.status === "FOUND_ALIVE" || input.status === "FOUND_DECEASED") && !input.resolutionNote) {
    throw ApiError.badRequest("A resolution note is required when marking a person as found (where/how they were located, who was informed)");
  }
  const updated = await MissingPersonModel.findByIdAndUpdate(id, { $set: { status: input.status, ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}) } }, { new: true }).populate("reporter", "name email");
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "missing_person.status", targetType: "MissingPerson", targetId: id, details: { status: input.status }, ipAddress: ip });
  if (doc.reporterId !== actor.id) {
    await notifyUser(doc.reporterId, `Missing person update: ${doc.fullName}`,
      input.status === "FOUND_ALIVE" ? `Good news — ${doc.fullName} has been marked as found alive. ${input.resolutionNote ?? ""}`
        : input.status === "FOUND_DECEASED" ? `We are very sorry — ${doc.fullName} has been marked as found deceased. ${input.resolutionNote ?? ""} Please contact the response team for support.`
          : `The search status for ${doc.fullName} is now ${input.status.toLowerCase()}.`,
      "SYSTEM", { type: "MissingPerson", id });
  }
  return out(updated as Doc);
}
