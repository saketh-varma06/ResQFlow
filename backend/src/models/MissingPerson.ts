import { Schema, model, Types } from "mongoose";
import { MISSING_PERSON_STATUSES } from "./enums";

/**
 * Collection: missingPersons — family-tracing reports (Stage G), modelled on the
 * ICRC Restoring Family Links posture: this is a tracing tool, NOT a public list.
 * Contact details and full records are visible only to the reporter and to
 * responders/admins doing tracing work. There is deliberately no public browse.
 */
export interface MissingPerson {
  _id: string;
  fullName: string;
  ageApprox?: number;
  gender?: string;
  description?: string;
  lastSeenLocation: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  lastSeenAt?: Date;
  circumstances?: string;
  reporterId: string;
  reporterRelationship: string;
  reporterPhone: string;
  status: string;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const missingPersonSchema = new Schema<MissingPerson>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    fullName: { type: String, required: true },
    ageApprox: { type: Number },
    gender: { type: String },
    description: { type: String },
    lastSeenLocation: { type: String, required: true },
    area: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    lastSeenAt: { type: Date },
    circumstances: { type: String },
    reporterId: { type: String, required: true, ref: "User" },
    reporterRelationship: { type: String, required: true },
    reporterPhone: { type: String, required: true },
    status: { type: String, enum: MISSING_PERSON_STATUSES, default: "REPORTED" },
    resolutionNote: { type: String },
  },
  { timestamps: true },
);
missingPersonSchema.index({ reporterId: 1 });
missingPersonSchema.index({ status: 1 });
missingPersonSchema.index({ fullName: 1 });
missingPersonSchema.virtual("reporter", { ref: "User", localField: "reporterId", foreignField: "_id", justOne: true });

export const MissingPersonModel = model<MissingPerson>("MissingPerson", missingPersonSchema, "missingPersons");
