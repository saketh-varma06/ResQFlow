import { Schema, model, Types } from "mongoose";
import { SHELTER_STATUSES, type ShelterStatus } from "./enums";

/**
 * Collection: shelters — mirrors Prisma model `Shelter`.
 * Validation parity with the current app: `capacity` must be ≥ 1 and
 * `occupied` must never exceed `capacity` (enforced in PostgreSQL-era code
 * by Zod refine + service checks; here by field validators + the document
 * validator below, which also covers shrink-below-occupancy updates when
 * the update path runs validators on the merged document).
 * `available` is NOT stored — it is computed (capacity − occupied) on read,
 * exactly as the current backend computes it on every response.
 */
export interface Shelter {
  _id: string;
  name: string;
  address: string;
  area: string;
  capacity: number;
  occupied: number;
  facilities: string[];
  accessibility?: string;
  contact?: string;
  latitude?: number;
  longitude?: number;
  status: ShelterStatus;
  /** Reference to users._id, null when the creator was removed. */
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const shelterSchema = new Schema<Shelter>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    area: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1, max: 1_000_000 },
    occupied: { type: Number, default: 0, min: 0 },
    facilities: { type: [String], default: [] },
    accessibility: { type: String },
    contact: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    status: { type: String, enum: SHELTER_STATUSES, default: "OPEN" },
    createdById: { type: String, ref: "User", default: null },
  },
  { timestamps: true },
);

shelterSchema.path("occupied").validate(function (value: number) {
  const capacity = (this as unknown as Shelter).capacity;
  return typeof capacity !== "number" || value <= capacity;
}, "occupied cannot exceed capacity");

shelterSchema.index({ area: 1 });
shelterSchema.index({ status: 1 });
shelterSchema.index({ status: 1, area: 1 });

export const ShelterModel = model<Shelter>(
  "Shelter",
  shelterSchema,
  "shelters",
);
