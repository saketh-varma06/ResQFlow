import { Schema, model, Types } from "mongoose";
import { RESPONDER_READINESS } from "./enums";
import type { ResponderReadiness } from "../types/enums";

/** Collection: responders — mirrors the former Prisma model `ResponderProfile`. */
export interface Responder {
  _id: string;
  userId: string;
  unitName: string;
  unitType: string;
  base: string;
  /** Base coordinates for OSRM dispatch ranking (Stage C). Units without them are listed unranked. */
  baseLat?: number;
  baseLng?: number;
  members: number;
  readiness: ResponderReadiness;
  rating?: number;
  serviceArea?: string;
  createdAt: Date;
  updatedAt: Date;
}

const responderSchema = new Schema<Responder>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    userId: { type: String, required: true, ref: "User" },
    unitName: { type: String, required: true },
    unitType: { type: String, required: true },
    base: { type: String, required: true },
    baseLat: { type: Number },
    baseLng: { type: Number },
    members: { type: Number, default: 1 },
    readiness: { type: String, enum: RESPONDER_READINESS, default: "STANDBY" },
    rating: { type: Number },
    serviceArea: { type: String },
  },
  { timestamps: true },
);

responderSchema.index({ userId: 1 }, { unique: true });
responderSchema.index({ readiness: 1 });
responderSchema.index({ unitType: 1 });

responderSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});
responderSchema.virtual("assignments", {
  ref: "Assignment",
  localField: "_id",
  foreignField: "responderProfileId",
});
responderSchema.virtual("sosAssignments", {
  ref: "SosRequest",
  localField: "_id",
  foreignField: "responderProfileId",
});

export const ResponderModel = model<Responder>("Responder", responderSchema, "responders");
