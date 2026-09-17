import { normalizeContent } from "./content.js";

/**
 * Pluggable evidence fetcher. The default implementation fetches a URL with
 * strict limits and extracts visible text very conservatively. Suppliers may
 * also construct EvidenceSubmission objects from their own search backends
 * without fetching here.
 */

export interface FetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
  fetchedAt: string;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchResult>;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 15_000;
const UA = "gap402-evidence-fetcher/0.1 (+https://github.com/tang-vu/gap402)";

export class HttpFetcher implements Fetcher {
  async fetch(url: string): Promise<FetchResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "user-agent": UA,
          accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5",
        },
      });
      const contentType = res.headers.get("content-type") ?? "";
      const reader = res.body?.getReader();
      if (!reader) throw new Error("empty body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.byteLength;
        if (size > MAX_BYTES) break;
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const raw = buf.toString("utf8");
      const text = contentType.includes("html") ? htmlToText(raw) : normalizeContent(raw);
      return {
        finalUrl: res.url || url,
        status: res.status,
        contentType,
        text,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Extremely conservative HTML-to-text: drop scripts/styles/tags entirely. */
export function htmlToText(html: string): string {
  const noScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = noScripts.replace(
    /<(br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi,
    "\n",
  );
  const text = withBreaks.replace(/<[^>]+>/g, " ");
  return normalizeContent(decodeEntities(text));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

/** Extract a best-effort publication date from common HTML metadata. */
export function extractPublishedAt(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["'](?:pubdate|publishdate|date|dc\.date|dcterms\.created)["'][^>]+content=["']([^"']+)/i,
    /<time[^>]+datetime=["']([^"']+)/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const d = new Date(m[1]);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}
