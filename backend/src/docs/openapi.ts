import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
let cached: unknown = null;
export function loadOpenApiSpec(): unknown {
  if (!cached) {
    // Works from src (tsx) and from dist (compiled): openapi.yaml is copied next to the app root at build time by the build script.
    const candidates = [join(process.cwd(), "openapi.yaml"), join(__dirname, "../../openapi.yaml"), join(__dirname, "../openapi.yaml")];
    let raw: string | null = null;
    for (const p of candidates) { try { raw = readFileSync(p, "utf8"); break; } catch { /* try next */ } }
    if (!raw) throw new Error("openapi.yaml not found");
    cached = parse(raw);
  }
  return cached;
}
