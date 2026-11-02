/** Case-insensitive literal "contains" filter (the former Prisma `{ contains, mode: "insensitive" }`). */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function ci(field: string, value: string): Record<string, unknown> {
  return { [field]: { $regex: escapeRegExp(value), $options: "i" } };
}
export function ciOr(fields: string[], value: string): { $or: Record<string, unknown>[] } {
  return { $or: fields.map((f) => ci(f, value)) };
}
