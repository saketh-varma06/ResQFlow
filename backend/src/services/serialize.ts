import type { User } from "@prisma/client";
export function publicUser<T extends Partial<User> & Record<string, unknown>>(user: T) {
  const { passwordHash: _ph, tokenVersion: _tv, ...rest } = user as Record<string, unknown>;
  return rest;
}
export function stripUserDeep<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(stripUserDeep) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "passwordHash" || k === "tokenVersion") continue;
      out[k] = stripUserDeep(v);
    }
    return out as T;
  }
  return value;
}
