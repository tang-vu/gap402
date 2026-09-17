import { keccak256, stringToHex, type Hex } from "viem";

/**
 * Normalize retrieved content for hashing: unicode NFC, whitespace collapse,
 * trimmed. Content hashes cover normalized text — never raw HTML.
 */
export function normalizeContent(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function contentHashOf(text: string): Hex {
  return keccak256(stringToHex(normalizeContent(text)));
}

/**
 * Build a bounded excerpt for storage. Never store full documents —
 * copyright and prompt-injection hygiene. We keep the head plus any windows
 * around claim keywords, capped at maxLen.
 */
export function buildExcerpt(text: string, keywords: string[], maxLen = 1200): string {
  const norm = normalizeContent(text);
  if (norm.length <= maxLen) return norm;

  const lower = norm.toLowerCase();
  const windows: Array<[number, number]> = [];
  for (const kw of keywords) {
    const needle = kw.toLowerCase().trim();
    if (!needle) continue;
    let idx = lower.indexOf(needle);
    while (idx !== -1) {
      const start = Math.max(0, idx - 160);
      const end = Math.min(norm.length, idx + needle.length + 240);
      windows.push([start, end]);
      idx = lower.indexOf(needle, end);
    }
  }
  windows.sort((a, b) => a[0] - b[0]);

  // merge overlapping windows
  const merged: Array<[number, number]> = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1] + 40) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }

  // scale the lead to the budget so small maxLen still leaves room for
  // keyword windows
  const leadLen = Math.min(320, Math.floor(maxLen / 3));
  let out = norm.slice(0, leadLen);
  let used = out.length;
  for (const [s0, e0] of merged) {
    const budget = maxLen - used - 8;
    if (budget < 32) break;
    let s = s0;
    let e = e0;
    if (e - s > budget) {
      // shrink the window around the earliest keyword hit inside it so the
      // cited term survives even when the full window does not fit
      let hitAt = -1;
      for (const kw of keywords) {
        const needle = kw.toLowerCase().trim();
        if (!needle) continue;
        const i = lower.indexOf(needle, s);
        if (i !== -1 && i < e && (hitAt === -1 || i < hitAt)) hitAt = i;
      }
      const center = hitAt === -1 ? s + Math.floor((e - s) / 2) : hitAt;
      s = Math.max(s, center - Math.floor(budget / 2));
      e = Math.min(e, s + budget);
    }
    if (e <= leadLen) continue;
    const piece = norm.slice(s, e);
    out += "\n…\n" + piece;
    used += piece.length + 8;
  }
  return out.slice(0, maxLen);
}

/**
 * Instruction-shaped phrases found in retrieved evidence are redacted so
 * they cannot be read as directives to the model.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
  /disregard\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
  /forget\s+(everything|all)\s+(you\s+)?(know|were\s+told)/gi,
  /you\s+are\s+now\s+(a|an|in)\b/gi,
  /new\s+system\s+(prompt|instructions?)/gi,
  /<\/?(system|assistant|user)>/gi,
];

/**
 * Sanitize untrusted retrieved content before it reaches any LLM prompt or
 * log. Strips control chars, neutralizes instruction-like phrases,
 * collapses whitespace, hard-caps length. The caller must still treat the
 * result as DATA, never instructions.
 */
export function sanitizeForPrompt(text: string, maxLen = 2000): string {
  // eslint-disable-next-line no-control-regex
  const stripped = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  let out = stripped;
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, "[filtered]");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, maxLen);
}
