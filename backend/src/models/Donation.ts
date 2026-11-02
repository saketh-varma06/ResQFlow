import { Schema, model, Types } from "mongoose";
import { DONATION_STATUSES, DONATION_TARGET_TYPES } from "./enums";

/**
 * Collection: donations — monetary relief donations (Stage H).
 * A donation starts as PLEDGED (the donor's recorded commitment + optional UPI/bank
 * transaction reference) and becomes RECEIVED only when staff verify the money
 * actually arrived. ResQFlow itself does not process payments — no card/UPI money
 * moves through this app; the ledger records and verifies, which is the honest
 * design for a platform without a payment-gateway account.
 */
export interface Donation {
  _id: string;
  donorId: string;
  donorName: string;
  amount: number;
  currency: string;
  targetType: string;
  targetId?: string | null;
  targetLabel: string;
  message?: string;
  paymentRef?: string;
  anonymous: boolean;
  status: string;
  receivedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

const donationSchema = new Schema<Donation>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    donorId: { type: String, required: true, ref: "User" },
    donorName: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    targetType: { type: String, enum: DONATION_TARGET_TYPES, default: "GENERAL" },
    targetId: { type: String, default: null },
    targetLabel: { type: String, required: true },
    message: { type: String },
    paymentRef: { type: String },
    anonymous: { type: Boolean, default: false },
    status: { type: String, enum: DONATION_STATUSES, default: "PLEDGED" },
    receivedById: { type: String, ref: "User" },
  },
  { timestamps: true },
);
donationSchema.index({ donorId: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ targetType: 1, targetId: 1 });
donationSchema.virtual("donor", { ref: "User", localField: "donorId", foreignField: "_id", justOne: true });

export const DonationModel = model<Donation>("Donation", donationSchema, "donations");
