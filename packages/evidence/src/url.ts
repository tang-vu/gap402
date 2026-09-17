/**
 * URL canonicalization for dedup. Strips tracking params, fragments,
 * trailing slashes, default ports, www., and lowercases scheme/host.
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "dclid",
  "msclkid",
  "ref",
  "ref_",
  "source",
  "si",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "vero_id",
  "wickedid",
  "twclid",
]);

export class UrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlError";
  }
}

export function canonicalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new UrlError(`Invalid URL: ${raw.slice(0, 120)}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UrlError(`Unsupported scheme: ${u.protocol}`);
  }
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.port = "";
  u.hash = "";
  // strip tracking params; sort remaining for canonical form
  const params = [...u.searchParams.entries()].filter(
    ([k]) => !TRACKING_PARAMS.has(k.toLowerCase()),
  );
  params.sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of params) u.searchParams.append(k, v);
  // normalize path: remove trailing slash (but keep root "/")
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

export function domainOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** Registrable-ish domain: last two labels. Good enough for independence
 * heuristics without pulling a PSL dependency. */
export function rootDomain(url: string): string {
  const host = domainOf(url);
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}
