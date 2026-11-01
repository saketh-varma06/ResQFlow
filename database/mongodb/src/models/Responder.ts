import { Schema, model, Types } from "mongoose";
import { RESPONDER_READINESS, type ResponderReadiness } from "./enums";

/**
 * Collection: responders — mirrors Prisma model `ResponderProfile`.
 *
 * DESIGN DECISION: a SEPARATE collection referencing `users`
 * (`userId` → users._id, unique), NOT an embedded sub-document on the user.
 * Justification: only RESPONDER users have a profile; responder data is
 * queried independently of accounts (dispatch filters by `readiness` and
 * `unitType`, assignments reference the responder directly), and embedding
 * would duplicate profile fields into every user lookup while making
 * responder-only indexes impossible. See docs/DATABASE_DESIGN.md §2.3.
 */
export interface Responder {
  _id: string;
  /** Reference to users._id (unique — one profile per responder user). */
  userId: string;
  unitName: string;
  unitType: string;
  base: string;
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
    unitName: { type: String, required: true, trim: true },
    unitType: { type: String, required: true, trim: true },
    base: { type: String, required: true, trim: true },
    members: { type: Number, default: 1, min: 1 },
    readiness: {
      type: String,
      enum: RESPONDER_READINESS,
      default: "STANDBY",
    },
    rating: { type: Number, min: 0, max: 5 },
    serviceArea: { type: String },
  },
  { timestamps: true },
);

responderSchema.index({ userId: 1 }, { unique: true });
responderSchema.index({ readiness: 1 });
responderSchema.index({ unitType: 1 });

export const ResponderModel = model<Responder>(
  "Responder",
  responderSchema,
  "responders",
);
