import { UserModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { hashPassword, signToken, verifyPassword } from "../utils/security";
import { writeAudit } from "../utils/audit";
import { publicUser } from "./serialize";
import type { z } from "zod";
import type { registerSchema, loginSchema, changePasswordSchema } from "../validators/auth.validators";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export async function register(input: RegisterInput, ip?: string) {
  const exists = await UserModel.findOne({ email: input.email });
  if (exists) throw ApiError.conflict("An account with this email already exists");
  if (input.phone) {
    const phoneTaken = await UserModel.findOne({ phone: input.phone });
    if (phoneTaken) throw ApiError.conflict("An account with this phone number already exists");
  }
  // Public self-registration: citizens activate immediately; responder/admin roles require approval.
  const elevated = input.role && input.role !== "CITIZEN";
  const user = await UserModel.create({
    name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password),
    role: input.role ?? "CITIZEN", status: elevated ? "PENDING" : "ACTIVE", area: input.area, address: input.address,
  });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "auth.register", targetType: "User", targetId: user.id, result: "SUCCESS", ipAddress: ip, details: { role: user.role, status: user.status } });
  const safe = publicUser(user as any);
  if (elevated) return { user: safe, token: null, message: "Account created and pending approval. Responder and administrator accounts are activated by an administrator." };
  return { user: safe, token: signToken({ id: user.id, email: user.email, name: user.name, role: user.role }, user.tokenVersion) };
}

export async function login(input: LoginInput, ip?: string) {
  const user = await UserModel.findOne({ email: input.email });
  const fail = async (reason: string) => {
    await writeAudit({ actorId: user?.id ?? null, actorEmail: input.email, action: "auth.login_failed", targetType: "User", targetId: user?.id ?? null, result: "DENIED", ipAddress: ip, details: { reason } });
    throw ApiError.unauthorized("Invalid email or password");
  };
  if (!user) return fail("no such user");
  if (!(await verifyPassword(input.password, user.passwordHash))) return fail("wrong password");
  if (user.status === "SUSPENDED") { await writeAudit({ actorId: user.id, actorEmail: user.email, action: "auth.login_denied", targetType: "User", targetId: user.id, result: "DENIED", ipAddress: ip }); throw ApiError.forbidden("This account is suspended"); }
  if (user.status === "PENDING") throw ApiError.forbidden("This account is pending approval");
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "auth.login", targetType: "User", targetId: user.id, ipAddress: ip });
  return { user: publicUser(user as any), token: signToken({ id: user.id, email: user.email, name: user.name, role: user.role }, user.tokenVersion) };
}

export async function me(userId: string) {
  const user = await UserModel.findById(userId).populate("responderProfile");
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user as any);
}

export async function changePassword(userId: string, input: z.infer<typeof changePasswordSchema>) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw ApiError.badRequest("Current password is incorrect");
  const updated = await UserModel.findByIdAndUpdate(userId, { $set: { passwordHash: await hashPassword(input.newPassword) }, $inc: { tokenVersion: 1 } }, { new: true });
  if (!updated) throw ApiError.notFound("User not found");
  await writeAudit({ actorId: userId, actorEmail: user.email, action: "auth.password_change", targetType: "User", targetId: userId });
  // All previous sessions are invalidated; the caller is re-issued a fresh session.
  return { changed: true, token: signToken({ id: updated.id, email: updated.email, name: updated.name, role: updated.role }, updated.tokenVersion), user: publicUser(updated as any) };
}

export async function logout(userId: string, ip?: string) {
  const user = await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  await writeAudit({ actorId: userId, actorEmail: user.email, action: "auth.logout", targetType: "User", targetId: userId, ipAddress: ip });
  return { loggedOut: true };
}
