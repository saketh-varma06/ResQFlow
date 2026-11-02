import { Schema, model, Types } from "mongoose";
import { PLEDGE_STATUSES } from "./enums";

/** Collection: pledges — a user's committed contribution against a shelter need (Stage D). */
export interface Pledge {
  _id: string;
  needId: string;
  shelterId: string;
  donorId: string;
  donorName: string;
  quantity: number;
  status: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pledgeSchema = new Schema<Pledge>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    needId: { type: String, required: true, ref: "ShelterNeed" },
    shelterId: { type: String, required: true, ref: "Shelter" },
    donorId: { type: String, required: true, ref: "User" },
    donorName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PLEDGE_STATUSES, default: "PLEDGED" },
    note: { type: String },
  },
  { timestamps: true },
);
pledgeSchema.index({ needId: 1 });
pledgeSchema.index({ donorId: 1 });
pledgeSchema.index({ shelterId: 1 });

export const PledgeModel = model<Pledge>("Pledge", pledgeSchema, "pledges");
