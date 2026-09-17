import {
  type CheckResult,
  type EvidenceRequirement,
  type EvidenceSubmission,
  type GapRequest,
} from "@gap402/schemas";
import { domainOf, rootDomain } from "@gap402/evidence";

/**
 * Deterministic checks — pure functions over declared submission metadata.
 * These run before any model judgment and are fully reproducible.
 */

export interface DeterministicContext {
  gap: GapRequest;
  existing: EvidenceSubmission[]; // prior submissions on this bounty
  now: Date;
}

export function runDeterministicChecks(
  sub: EvidenceSubmission,
  ctx: DeterministicContext,
): CheckResult[] {
  const req: EvidenceRequirement = ctx.gap.requirements;
  const checks: CheckResult[] = [];
  const push = (name: string, passed: boolean, detail?: string) =>
    checks.push({ name, passed, ...(detail ? { detail } : {}) });

  // 1. URL resolvable + well-formed (canonicalization already applied)
  let host = "";
  try {
    host = domainOf(sub.canonicalUrl);
    push("url_resolvable", /^https?:\/\//.test(sub.canonicalUrl));
  } catch {
    push("url_resolvable", false, "unparseable URL");
  }

  // 2. duplicate detection: canonical URL or content hash collision
  if (req.rejectDuplicates) {
    const dupUrl = ctx.existing.find((e) => e.canonicalUrl === sub.canonicalUrl);
    const dupHash = ctx.existing.find((e) => e.contentHash === sub.contentHash);
    const dup = dupUrl ?? dupHash;
    push(
      "not_duplicate",
      !dup,
      dup
        ? `duplicate of submission ${dup.id} (${dupUrl ? "url" : "content-hash"})`
        : undefined,
    );
  }

  // 3. domain allow/block lists
  if (req.domainAllowlist?.length) {
    const ok = req.domainAllowlist.some((d) => host === d || host.endsWith("." + d));
    push("domain_allowlist", ok, `host=${host}`);
  }
  if (req.domainBlocklist?.length) {
    const bad = req.domainBlocklist.some((d) => host === d || host.endsWith("." + d));
    push("domain_blocklist", !bad, `host=${host}`);
  }

  // 4. publication date requirements
  if (req.minPublishedAt || req.maxSourceAgeSeconds) {
    if (!sub.publishedAt) {
      push("publication_date", false, "publishedAt missing");
    } else {
      const pub = new Date(sub.publishedAt);
      if (req.minPublishedAt) {
        push(
          "min_published_at",
          pub >= new Date(req.minPublishedAt),
          `publishedAt=${sub.publishedAt} min=${req.minPublishedAt}`,
        );
      }
      if (req.maxSourceAgeSeconds) {
        const age = (ctx.now.getTime() - pub.getTime()) / 1000;
        push(
          "max_source_age",
          age <= req.maxSourceAgeSeconds && age >= -3600,
          `age=${Math.round(age)}s max=${req.maxSourceAgeSeconds}s`,
        );
      }
    }
  }

  // 5. source-type requirements
  if (req.allowedSourceTypes?.length) {
    push(
      "source_type_allowed",
      req.allowedSourceTypes.includes(sub.sourceType),
      `sourceType=${sub.sourceType}`,
    );
  }
  if (req.bannedSourceTypes?.length) {
    push(
      "source_type_not_banned",
      !req.bannedSourceTypes.includes(sub.sourceType),
      `sourceType=${sub.sourceType}`,
    );
  }
  if (req.requirePrimarySource) {
    push(
      "primary_source_required",
      sub.sourceType === "primary" || sub.sourceType === "official",
      `sourceType=${sub.sourceType}`,
    );
  }

  // 6. citation requirement — must carry title or excerpt
  if (req.requireCitation) {
    push(
      "citation_present",
      Boolean(sub.title || sub.excerpt),
      sub.title ? "title" : sub.excerpt ? "excerpt" : "none",
    );
  }

  // 7. independence heuristic — supplier domain differs from every prior
  //    accepted submission's root domain, and from the supplier's own address
  if (req.requireIndependentSources) {
    const rd = rootDomain(sub.canonicalUrl);
    const clash = ctx.existing.find((e) => rootDomain(e.canonicalUrl) === rd);
    push(
      "independent_domain",
      !clash,
      clash ? `shares root domain with ${clash.id} (${rd})` : rd,
    );
  }

  return checks;
}

export function deterministicRejectReasons(checks: CheckResult[]): string[] {
  return checks
    .filter((c) => !c.passed)
    .map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ""}`);
}

/* ── deterministic score components ───────────────────────────────── */

const SOURCE_TYPE_PROVENANCE: Record<string, number> = {
  official: 950_000,
  primary: 900_000,
  independent: 800_000,
  aggregated: 400_000,
  wiki: 500_000,
  social: 200_000,
  unknown: 300_000,
};

export function provenanceScore(sub: EvidenceSubmission): number {
  return SOURCE_TYPE_PROVENANCE[sub.sourceType] ?? 300_000;
}

export function freshnessScore(
  sub: EvidenceSubmission,
  req: EvidenceRequirement,
  now: Date,
): number {
  if (!sub.publishedAt) return 500_000; // unknown freshness
  const ageSec = (now.getTime() - new Date(sub.publishedAt).getTime()) / 1000;
  const max = req.maxSourceAgeSeconds ?? 30 * 24 * 3600;
  if (ageSec < 0) return 0;
  if (ageSec >= max) return 0;
  // linear decay to 60% floor inside the window
  const frac = 1 - (ageSec / max) * 0.4;
  return Math.round(frac * 1_000_000);
}

export function independenceScore(
  sub: EvidenceSubmission,
  ctx: DeterministicContext,
): number {
  const rd = rootDomain(sub.canonicalUrl);
  const clash = ctx.existing.find((e) => rootDomain(e.canonicalUrl) === rd);
  if (clash) return 300_000;
  if (sub.sourceType === "official") return 700_000;
  if (sub.sourceType === "primary") return 850_000;
  if (sub.sourceType === "independent") return 900_000;
  return 500_000;
}

export function noveltyScore(sub: EvidenceSubmission, ctx: DeterministicContext): number {
  const sameHash = ctx.existing.some((e) => e.contentHash === sub.contentHash);
  if (sameHash) return 0;
  const sameUrl = ctx.existing.some((e) => e.canonicalUrl === sub.canonicalUrl);
  if (sameUrl) return 50_000;
  const sameRoot = ctx.existing.some(
    (e) => rootDomain(e.canonicalUrl) === rootDomain(sub.canonicalUrl),
  );
  return sameRoot ? 600_000 : 900_000;
}
