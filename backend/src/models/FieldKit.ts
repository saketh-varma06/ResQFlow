import { Schema, model, Types } from "mongoose";
import { STATUS_HISTORY_ENTITY_TYPES } from "./enums";

/** Collection: checklistStates — which checklist items are ticked for an incident/SOS (Stage E). */
export interface ChecklistState {
  _id: string;
  entityType: string;
  entityId: string;
  category: string;
  checkedKeys: string[];
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}
const checklistStateSchema = new Schema<ChecklistState>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    entityType: { type: String, required: true, enum: STATUS_HISTORY_ENTITY_TYPES },
    entityId: { type: String, required: true },
    category: { type: String, required: true },
    checkedKeys: { type: [String], default: [] },
    updatedById: { type: String, required: true, ref: "User" },
  },
  { timestamps: true },
);
checklistStateSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
checklistStateSchema.virtual("updatedBy", { ref: "User", localField: "updatedById", foreignField: "_id", justOne: true });
export const ChecklistStateModel = model<ChecklistState>("ChecklistState", checklistStateSchema, "checklistStates");

/** Collection: fieldReports — structured situation reports filed from the field (Stage E). */
export interface FieldReport {
  _id: string;
  entityType: string;
  entityId: string;
  authorId: string;
  situation: string;
  peopleCount?: number;
  injuriesCount?: number;
  needsSummary?: string;
  risks?: string;
  createdAt: Date;
  updatedAt: Date;
}
const fieldReportSchema = new Schema<FieldReport>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toHexString() },
    entityType: { type: String, required: true, enum: STATUS_HISTORY_ENTITY_TYPES },
    entityId: { type: String, required: true },
    authorId: { type: String, required: true, ref: "User" },
    situation: { type: String, required: true },
    peopleCount: { type: Number },
    injuriesCount: { type: Number },
    needsSummary: { type: String },
    risks: { type: String },
  },
  { timestamps: true },
);
fieldReportSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
fieldReportSchema.virtual("author", { ref: "User", localField: "authorId", foreignField: "_id", justOne: true });
export const FieldReportModel = model<FieldReport>("FieldReport", fieldReportSchema, "fieldReports");
