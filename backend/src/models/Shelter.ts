import { Schema, model, Types } from "mongoose";
import { SHELTER_STATUSES } from "./enums";
import type { ShelterStatus } from "../types/enums";

/** Collection: shelters — mirrors the former Prisma model `Shelter`. */
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
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const shelterSchema = new Schema<Shelter>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    name: { type: String, required: true },
    address: { type: String, required: true },
    area: { type: String, required: true },
    capacity: { type: Number, required: true },
    occupied: { type: Number, default: 0 },
    facilities: { type: [String], default: [] },
    accessibility: { type: String },
    contact: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    status: { type: String, enum: SHELTER_STATUSES, default: "OPEN" },
    createdById: { type: String, ref: "User", default: null },
  },
  { timestamps: true },
);

shelterSchema.index({ area: 1 });
shelterSchema.index({ status: 1 });

export const ShelterModel = model<Shelter>("Shelter", shelterSchema, "shelters");
