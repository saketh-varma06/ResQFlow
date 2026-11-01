import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "../types/auth";
export function hashPassword(plain: string) { return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS); }
export function verifyPassword(plain: string, hash: string) { return bcrypt.compare(plain, hash); }
export function signToken(user: AuthUser, tokenVersion: number) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, tv: tokenVersion }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}
export interface TokenPayload { sub: string; email: string; role: AuthUser["role"]; tv: number; exp?: number }
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
