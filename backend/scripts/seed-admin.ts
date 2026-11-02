/**
 * Safe administrator seeding — the ONLY supported way to create the first admin.
 *
 *   ADMIN_EMAIL=you@example.org ADMIN_NAME="Your Name" ADMIN_PASSWORD='<strong password>' npm run db:seed-admin
 *
 * Safety rules:
 * - Password must be provided via the environment (never hard-coded) and be at least 12 characters.
 * - In production (NODE_ENV=production) the well-known demo password is refused outright.
 * - Idempotent: re-running updates the named account's name/password and forces role ADMIN + status ACTIVE.
 * - Public registration can never create an active admin (it creates PENDING accounts); approval happens
 *   either here or by an existing admin via PATCH /api/users/:id.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectMongo, disconnectMongo } from "../src/db/mongo";
import { UserModel } from "../src/models";

const DEMO_PASSWORD = "Admin@12345";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "ResQFlow Administrator").trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters (provide it via the environment)");
  if (process.env.NODE_ENV === "production" && password === DEMO_PASSWORD) throw new Error("Refusing to seed the demo password in production");
  const passwordHash = await bcrypt.hash(password, 12);
  await connectMongo();
  const existing = await UserModel.findOne({ email });
  let user;
  if (existing) {
    user = (await UserModel.findByIdAndUpdate(existing.id, { $set: { name, passwordHash, role: "ADMIN", status: "ACTIVE" }, $inc: { tokenVersion: 1 } }, { new: true })) ?? existing;
  } else {
    user = await UserModel.create({ email, name, passwordHash, role: "ADMIN", status: "ACTIVE" });
  }
  console.log(`Admin ready: ${user.email} (id ${user.id}, role ADMIN, status ACTIVE). Password was set from ADMIN_PASSWORD and is not printed.`);
}
main().catch((e) => { console.error(`seed-admin failed: ${(e as Error).message}`); process.exit(1); }).finally(() => disconnectMongo());
