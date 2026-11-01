import { Schema, model, Types } from "mongoose";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "./enums";

/**
 * Collection: users — mirrors Prisma model `User`.
 * PostgreSQL `id` (cuid string) is preserved as the string `_id` during
 * migration so every existing reference and API identifier stays valid.
 * `passwordHash` and `tokenVersion` are server-only fields and must never be
 * serialised to clients (same rule as the current Prisma serialiser).
 */
export interface User {
  _id: string;
  email: string;
  phone?: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  /** Session invalidation counter — JWT carries `tv`; logout/password change increments it. */
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "CITIZEN" },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE" },
    tokenVersion: { type: Number, default: 0, min: 0 },
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

export const UserModel = model<User>("User", userSchema, "users");
