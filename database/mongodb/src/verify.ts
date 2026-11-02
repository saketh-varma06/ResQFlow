/**
 * Atlas verification script — proves the prepared Mongoose layer against a
 * REAL MongoDB Atlas cluster. Run with:  npm run verify   (in this folder)
 *
 * Reads MONGODB_URI from the environment, falling back to backend/.env.
 * Exits 2 with a clear message when the URI is unset or still contains the
 * <db_password> placeholder — it never invents credentials.
 *
 * What it proves (each printed PASS/FAIL is a real round-trip):
 *  1. Connection + ping, and every model's indexes build (incl. 2dsphere).
 *  2. A user document stores a bcrypt password hash, never plaintext.
 *  3. A wrong-password connection is rejected by Atlas (auth works).
 *  4. An SOS document with a GeoJSON location is created and read back.
 *  5. Status-history rows for that SOS are preserved.
 *  6. A $near geospatial query finds a shelter at the SOS location and does
 *     NOT find it from a far-away point.
 * Test documents are removed at the end; counts are printed before cleanup.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectMongo, disconnectMongo, mongoHealth } from "./index";
import {
  AlertModel,
  AssignmentModel,
  AuditLogModel,
  IncidentModel,
  NotificationModel,
  ResponderModel,
  ShelterModel,
  SosRequestModel,
  StatusHistoryModel,
  UserModel,
} from "./models";

function loadUri(): string | undefined {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const candidates = [
    resolve(process.cwd(), "../../backend/.env"),
    resolve(__dirname, "../../../backend/.env"),
  ];
  for (const envPath of candidates) {
    try {
      const line = readFileSync(envPath, "utf8")
        .split("\n")
        .find((l) => l.startsWith("MONGODB_URI="));
      if (line) return line.slice("MONGODB_URI=".length).trim();
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main(): Promise<void> {
  const uri = loadUri();
  if (!uri) {
    console.error("BLOCKED: MONGODB_URI is not set (env or backend/.env). Atlas cannot be verified.");
    process.exit(2);
  }
  if (uri.includes("<db_password>")) {
    console.error("BLOCKED: MONGODB_URI still contains the <db_password> placeholder. Replace it with the real database password, then re-run: npm run verify");
    process.exit(2);
  }

  process.env.MONGODB_URI = uri; // connectMongo() reads the env var
  const run = Date.now().toString(36);
  const testEmail = `atlas-verify-${run}@resqflow.local`;
  const plainPassword = "AtlasVerify@12345";
  let userId = "";
  let sosId = "";
  let shelterId = "";

  try {
    await connectMongo();
    const health = await mongoHealth();
    check("connect + ping", health.connected === true, health.message);

    const models = [
      UserModel, ResponderModel, IncidentModel, SosRequestModel, ShelterModel,
      AlertModel, NotificationModel, AssignmentModel, StatusHistoryModel, AuditLogModel,
    ];
    for (const m of models) await m.syncIndexes();
    const shelterIndexes = await ShelterModel.collection.indexes();
    check(
      "indexes built (incl. shelter 2dsphere)",
      shelterIndexes.some((i) => JSON.stringify(i.key).includes("2dsphere")),
      `${shelterIndexes.length} shelter indexes`,
    );

    // 2 — user with a hashed password
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const user = await UserModel.create({
      email: testEmail,
      name: "Atlas Verify",
      passwordHash,
      role: "CITIZEN",
      status: "ACTIVE",
    });
    userId = user._id;
    const raw = await UserModel.findById(userId).lean();
    check(
      "user stored with bcrypt hash (not plaintext)",
      !!raw && typeof raw.passwordHash === "string" && raw.passwordHash.startsWith("$2") && raw.passwordHash !== plainPassword,
      `hash length ${raw?.passwordHash?.length ?? 0}`,
    );
    check(
      "bcrypt compare verifies the password",
      !!raw && (await bcrypt.compare(plainPassword, raw.passwordHash)),
    );

    // 4 — SOS with GeoJSON location (Delhi)
    const sos = await SosRequestModel.create({
      citizenId: userId,
      need: "Atlas verification SOS",
      category: "FLOOD",
      people: 3,
      injuriesReported: 0,
      trapped: false,
      priorityScore: 42,
      priorityLevel: "MEDIUM",
      priorityReasons: ["verification"],
      locationText: "Connaught Place, New Delhi",
      location: { type: "Point", coordinates: [77.209, 28.6315] },
      status: "SUBMITTED",
    });
    sosId = sos._id;
    const sosBack = await SosRequestModel.findById(sosId).lean();
    check(
      "SOS created + read back with GeoJSON location",
      !!sosBack && sosBack.location?.coordinates?.[0] === 77.209,
      `sos ${sosId}`,
    );

    // 5 — status history preserved
    await StatusHistoryModel.create([
      { entityType: "SOS", entityId: sosId, toStatus: "SUBMITTED", changedById: userId },
      { entityType: "SOS", entityId: sosId, toStatus: "ACKNOWLEDGED", changedById: userId },
    ]);
    const historyCount = await StatusHistoryModel.countDocuments({ entityType: "SOS", entityId: sosId });
    check("status history rows preserved", historyCount === 2, `${historyCount} rows`);

    // 6 — geospatial: shelter near the SOS is found; from Chennai it is not
    const shelter = await ShelterModel.create({
      name: `Atlas Verify Shelter ${run}`,
      address: "Connaught Place, New Delhi",
      area: "Central Delhi",
      capacity: 500,
      occupied: 10,
      facilities: ["Water", "Food"],
      status: "OPEN",
      location: { type: "Point", coordinates: [77.2095, 28.632] },
    });
    shelterId = shelter._id;
    const near = await ShelterModel.find({
      location: { $near: { $geometry: { type: "Point", coordinates: [77.209, 28.6315] }, $maxDistance: 5000 } },
    }).lean();
    check("$near finds the shelter within 5 km", near.some((s) => s._id === shelterId), `${near.length} shelter(s) near Delhi point`);
    const far = await ShelterModel.find({
      location: { $near: { $geometry: { type: "Point", coordinates: [80.2707, 13.0827] }, $maxDistance: 5000 } },
    }).lean();
    check("$near from Chennai (far point) excludes it", !far.some((s) => s._id === shelterId));

    // 3 — wrong password must be rejected
    const wrongUri = uri.replace(/:([^:@/]+)@/, ":definitely-wrong-password@");
    let rejected = false;
    try {
      const bad = await mongoose.createConnection(wrongUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
      await bad.close();
    } catch {
      rejected = true;
    }
    check("wrong-password connection rejected by Atlas", rejected);
  } finally {
    // Cleanup of this run's test documents (counts were printed above).
    try {
      if (sosId) await StatusHistoryModel.deleteMany({ entityId: sosId });
      if (sosId) await SosRequestModel.deleteOne({ _id: sosId });
      if (shelterId) await ShelterModel.deleteOne({ _id: shelterId });
      if (userId) await UserModel.deleteOne({ _id: userId });
    } catch {
      console.warn("cleanup incomplete — check for atlas-verify test documents");
    }
    await disconnectMongo().catch(() => undefined);
  }

  console.log(failures === 0 ? "\nATLAS VERIFICATION: ALL CHECKS PASSED" : `\nATLAS VERIFICATION: ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error("BLOCKED/ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
