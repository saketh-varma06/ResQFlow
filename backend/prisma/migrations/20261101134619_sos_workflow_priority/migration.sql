-- CreateEnum
CREATE TYPE "SOSCategory" AS ENUM ('FLOOD', 'FIRE', 'LANDSLIDE', 'MEDICAL', 'TRAPPED', 'INFRASTRUCTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- AlterEnum
BEGIN;
CREATE TYPE "IncidentStatus_new" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
ALTER TABLE "public"."Incident" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Incident" ALTER COLUMN "status" TYPE "IncidentStatus_new" USING ((CASE "status"::text WHEN 'REPORTED' THEN 'SUBMITTED' WHEN 'VERIFIED' THEN 'ACKNOWLEDGED' ELSE "status"::text END)::"IncidentStatus_new");
ALTER TABLE "IncidentStatusHistory" ALTER COLUMN "fromStatus" TYPE "IncidentStatus_new" USING ((CASE "fromStatus"::text WHEN 'REPORTED' THEN 'SUBMITTED' WHEN 'VERIFIED' THEN 'ACKNOWLEDGED' ELSE "fromStatus"::text END)::"IncidentStatus_new");
ALTER TABLE "IncidentStatusHistory" ALTER COLUMN "toStatus" TYPE "IncidentStatus_new" USING ((CASE "toStatus"::text WHEN 'REPORTED' THEN 'SUBMITTED' WHEN 'VERIFIED' THEN 'ACKNOWLEDGED' ELSE "toStatus"::text END)::"IncidentStatus_new");
ALTER TYPE "IncidentStatus" RENAME TO "IncidentStatus_old";
ALTER TYPE "IncidentStatus_new" RENAME TO "IncidentStatus";
DROP TYPE "public"."IncidentStatus_old";
ALTER TABLE "Incident" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SOSStatus_new" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');
ALTER TABLE "public"."SOSRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SOSRequest" ALTER COLUMN "status" TYPE "SOSStatus_new" USING ((CASE "status"::text WHEN 'NEW' THEN 'SUBMITTED' WHEN 'TEAM_ASSIGNED' THEN 'ASSIGNED' ELSE "status"::text END)::"SOSStatus_new");
ALTER TYPE "SOSStatus" RENAME TO "SOSStatus_old";
ALTER TYPE "SOSStatus_new" RENAME TO "SOSStatus";
DROP TYPE "public"."SOSStatus_old";
ALTER TABLE "SOSRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "injuriesReported" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priorityLevel" "PriorityLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "priorityReasons" TEXT[],
ADD COLUMN     "priorityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trapped" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE "SOSRequest" ADD COLUMN     "category" "SOSCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "injuriesReported" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priorityLevel" "PriorityLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "priorityReasons" TEXT[],
ADD COLUMN     "priorityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trapped" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- CreateTable
CREATE TABLE "SOSStatusHistory" (
    "id" TEXT NOT NULL,
    "sosId" TEXT NOT NULL,
    "fromStatus" "SOSStatus",
    "toStatus" "SOSStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOSStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SOSStatusHistory_sosId_createdAt_idx" ON "SOSStatusHistory"("sosId", "createdAt");

-- CreateIndex
CREATE INDEX "SOSStatusHistory_changedById_idx" ON "SOSStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "Incident_priorityLevel_idx" ON "Incident"("priorityLevel");

-- CreateIndex
CREATE INDEX "SOSRequest_priorityLevel_idx" ON "SOSRequest"("priorityLevel");

-- AddForeignKey
ALTER TABLE "SOSStatusHistory" ADD CONSTRAINT "SOSStatusHistory_sosId_fkey" FOREIGN KEY ("sosId") REFERENCES "SOSRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOSStatusHistory" ADD CONSTRAINT "SOSStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

