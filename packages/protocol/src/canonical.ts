/**
 * Deterministic canonical JSON: recursively sorted object keys, no
 * insignificant whitespace, undefined fields dropped. This is the single
 * serialization used for all protocol hashes (specHash, settlementHash,
 * receiptHash, contentHash of structured objects).
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortDeep(v);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Non-finite number cannot be canonicalized");
  }
  return value;
}
