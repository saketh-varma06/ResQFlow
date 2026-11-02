/**
 * Serialisation layer — converts Mongoose documents into the exact JSON
 * shapes the former Prisma queries produced:
 *  - `_id` becomes `id` (recursively, including populated sub-documents)
 *  - `__v` is dropped
 *  - unset scalar model fields appear as `null` (Prisma returned every
 *    scalar field, with null for empty optionals)
 *  - relation keys appear only when the relation was populated
 *    (Prisma only included relations named in `include`)
 *  - StatusHistory entries expose `incidentId` / `sosId` instead of the
 *    storage-level `entityType` / `entityId` pair
 *  - `passwordHash` and `tokenVersion` never leave the server
 */

type Plain = Record<string, unknown>;

function isMongooseDoc(v: unknown): v is { toObject: (o?: object) => Plain; schema: { paths: Record<string, unknown>; virtuals: Record<string, unknown> }; populated: (p: string) => unknown } {
  return !!v && typeof v === "object" && typeof (v as { toObject?: unknown }).toObject === "function" && !!(v as { schema?: unknown }).schema;
}

export function toApi<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => toApi(v)) as T;
  if (isMongooseDoc(value)) {
    const obj = value.toObject({ virtuals: true }) as Plain;
    // Drop relation keys that were not populated (Prisma `include` parity).
    // Exception: a justOne relation whose foreign key is null WAS included —
    // Prisma returned it as null (e.g. an unassigned SOS's responderProfile),
    // but Mongoose does not register population for a null local field.
    for (const [name, virt] of Object.entries(value.schema.virtuals)) {
      if (name === "id" || value.populated(name)) continue;
      const opts = (virt as { options?: { localField?: unknown; justOne?: boolean } }).options;
      const localField = typeof opts?.localField === "string" ? opts.localField : undefined;
      if (opts?.justOne && localField && (value as unknown as { get: (p: string) => unknown }).get(localField) == null) {
        obj[name] = null;
      } else {
        delete obj[name];
      }
    }
    // Null-fill unset scalar schema paths (Prisma returned nulls).
    for (const path of Object.keys(value.schema.paths)) {
      if (path === "_id" || path === "__v" || path.includes(".")) continue;
      if (obj[path] === undefined) obj[path] = null;
    }
    return toApi(obj) as T;
  }
  if (value && typeof value === "object") {
    const src = value as Plain;
    const out: Plain = {};
    // StatusHistory storage shape → API shape (with the same _id/__v normalisation).
    if (typeof src.entityType === "string" && typeof src.entityId === "string") {
      const { entityType, entityId, _id, __v, ...rest } = src;
      const mapped: Plain = { ...rest };
      if (_id !== undefined) mapped.id = _id;
      mapped[entityType === "INCIDENT" ? "incidentId" : "sosId"] = entityId;
      for (const [k, v] of Object.entries(mapped)) out[k] = toApi(v);
      return out as T;
    }
    for (const [k, v] of Object.entries(src)) {
      if (k === "__v") continue;
      if (k === "_id") {
        out.id = v;
        continue;
      }
      out[k] = toApi(v);
    }
    return out as T;
  }
  return value;
}

/** Strip server-only credential fields at any depth (kept from the Prisma era). */
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

/** Full output pipeline for service results: Mongoose → Prisma-shaped JSON, minus secrets. */
export function out<T>(value: T): T {
  return stripUserDeep(toApi(value));
}

/** Public view of a single user record (top-level passwordHash/tokenVersion removed). */
export function publicUser<T extends Record<string, unknown>>(user: T) {
  const plain = toApi(user) as Record<string, unknown>;
  const { passwordHash: _ph, tokenVersion: _tv, ...rest } = plain;
  return rest;
}
