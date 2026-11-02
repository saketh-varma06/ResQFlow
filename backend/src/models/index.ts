export * from "./enums";
export { UserModel, type User } from "./User";
export { ResponderModel, type Responder } from "./Responder";
export { IncidentModel, type Incident } from "./Incident";
export { SosRequestModel, type SosRequest } from "./SosRequest";
export { ShelterModel, type Shelter } from "./Shelter";
export { AlertModel, type Alert } from "./Alert";
export { NotificationModel, type Notification } from "./Notification";
export { AssignmentModel, type Assignment } from "./Assignment";
export { StatusHistoryModel, type StatusHistory, type StatusHistoryEntityType } from "./StatusHistory";
export { AuditLogModel, type AuditLog } from "./AuditLog";
export { AlertSubscriptionModel, type AlertSubscription } from "./AlertSubscription";
export { PushSubscriptionModel, type PushSubscription } from "./PushSubscription";
export { ShelterNeedModel, type ShelterNeed } from "./ShelterNeed";
export { PledgeModel, type Pledge } from "./Pledge";
export { ChecklistStateModel, FieldReportModel, type ChecklistState, type FieldReport } from "./FieldKit";
export { MissingPersonModel, type MissingPerson } from "./MissingPerson";

import { UserModel } from "./User";
import { ResponderModel } from "./Responder";
import { IncidentModel } from "./Incident";
import { SosRequestModel } from "./SosRequest";
import { ShelterModel } from "./Shelter";
import { AlertModel } from "./Alert";
import { NotificationModel } from "./Notification";
import { AssignmentModel } from "./Assignment";
import { StatusHistoryModel } from "./StatusHistory";
import { AuditLogModel } from "./AuditLog";
import { AlertSubscriptionModel } from "./AlertSubscription";
import { PushSubscriptionModel } from "./PushSubscription";
import { ShelterNeedModel } from "./ShelterNeed";
import { PledgeModel } from "./Pledge";
import { ChecklistStateModel, FieldReportModel } from "./FieldKit";
import { MissingPersonModel } from "./MissingPerson";

/** All models, for index sync and test cleanup. */
export const ALL_MODELS = [
  UserModel,
  ResponderModel,
  IncidentModel,
  SosRequestModel,
  ShelterModel,
  AlertModel,
  NotificationModel,
  AssignmentModel,
  StatusHistoryModel,
  AuditLogModel,
  AlertSubscriptionModel,
  PushSubscriptionModel,
  ShelterNeedModel,
  PledgeModel,
  ChecklistStateModel,
  FieldReportModel,
  MissingPersonModel,
] as const;
