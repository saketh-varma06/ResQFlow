import { Schema, model, Types } from "mongoose";
import { USER_ROLES, USER_STATUSES } from "./enums";
import type { UserRole, UserStatus } from "../types/enums";

/**
 * Collection: users — mirrors the former Prisma model `User`.
 * `_id` is a string (ObjectId hex) so API identifiers keep the same shape.
 * `passwordHash` and `tokenVersion` are server-only; the serialiser strips them.
 */
export interface User {
  _id: string;
  email: string;
  phone?: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  area?: string;
  address?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    email: { type: String, required: true },
    phone: { type: String },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "CITIZEN" },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE" },
    tokenVersion: { type: Number, default: 0 },
    area: { type: String },
    address: { type: String },
    bloodGroup: { type: String },
    medicalNotes: { type: String },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ area: 1 });

userSchema.virtual("responderProfile", {
  ref: "Responder",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

export const UserModel = model<User>("User", userSchema, "users");
