import { Schema, model, Types } from "mongoose";
import { NEED_CATEGORIES, NEED_STATUSES } from "./enums";

/**
 * Collection: shelterNeeds — an itemised relief need posted for a shelter (Stage D).
 * quantityPledged is a maintained aggregate of PLEDGED + DELIVERED pledges.
 */
export interface ShelterNeed {
  _id: string;
  shelterId: string;
  item: string;
  category: string;
  quantityNeeded: number;
  quantityPledged: number;
  unit: string;
  status: string;
  notes?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const shelterNeedSchema = new Schema<ShelterNeed>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    shelterId: { type: String, required: true, ref: "Shelter" },
    item: { type: String, required: true },
    category: { type: String, enum: NEED_CATEGORIES, default: "OTHER" },
    quantityNeeded: { type: Number, required: true, min: 1 },
    quantityPledged: { type: Number, default: 0 },
    unit: { type: String, default: "units" },
    status: { type: String, enum: NEED_STATUSES, default: "OPEN" },
    notes: { type: String },
    createdById: { type: String, required: true, ref: "User" },
  },
  { timestamps: true },
);
shelterNeedSchema.index({ shelterId: 1, status: 1 });

shelterNeedSchema.virtual("shelter", { ref: "Shelter", localField: "shelterId", foreignField: "_id", justOne: true });
shelterNeedSchema.virtual("pledges", { ref: "Pledge", localField: "_id", foreignField: "needId" });

export const ShelterNeedModel = model<ShelterNeed>("ShelterNeed", shelterNeedSchema, "shelterNeeds");
