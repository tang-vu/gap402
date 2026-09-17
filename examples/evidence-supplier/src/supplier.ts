import { Gap402 } from "@gap402/sdk";
import { canonicalizeUrl, contentHashOf } from "@gap402/evidence";
import type { GapRequest } from "@gap402/schemas";

/**
 * Evidence supplier strategies. Each supplier is an independent agent that:
 *  1. polls open gaps,
 *  2. decides whether a bounty is worth pursuing,
 *  3. spends bounded search effort via a pluggable SourceProvider,
 *  4. submits candidate evidence with its payout address.
 *
 * SourceProvider is the seam between "real web" and "simulated" sources —
 * fixture providers are for deterministic demos/tests only and are labelled
 * as such; nothing simulated is ever presented as real evidence.
 */

export interface CandidateSource {
  url: string;
  title?: string | undefined;
  publisher?: string | undefined;
  publishedAt?: string | undefined;
  excerpt?: string | undefined;
  content?: string | undefined;
  claimRelation?: "supports" | "contradicts" | "contextual" | "unrelated" | "unknown";
  sourceType?: "official" | "primary" | "independent" | "aggregated" | "social" | "wiki";
}

/** Search/discovery backend. Real impls: web search, RSS, direct fetches. */
export interface SourceProvider {
  name: string;
  search(query: string, limit: number): Promise<CandidateSource[]>;
}

export interface SupplierPolicy {
  /** Don't chase bounties whose expected share is below this (units). */
  minExpectedRewardUnits: bigint;
  /** Skip gaps with less than this many seconds left. */
  minTimeLeftSeconds: number;
  /** Max candidates to fetch per gap (search effort budget). */
  maxSearchResults: number;
}

export const DEFAULT_SUPPLIER_POLICY: SupplierPolicy = {
  minExpectedRewardUnits: 1_000n, // 0.001 USDC
  minTimeLeftSeconds: 30,
  maxSearchResults: 5,
};

export abstract class BaseSupplier {
  abstract readonly name: string;

  constructor(
    protected gap402: Gap402,
    protected provider: SourceProvider,
    protected address: `0x${string}`,
    protected policy: SupplierPolicy = DEFAULT_SUPPLIER_POLICY,
  ) {}

  /** Subclasses filter/rank candidates to their specialty. */
  protected abstract select(
    candidates: CandidateSource[],
    gap: GapRequest,
  ): CandidateSource[];

  protected worthPursuing(gap: GapRequest): boolean {
    const budget = BigInt(gap.budgetUnits);
    const timeLeft = (new Date(gap.deadline).getTime() - Date.now()) / 1000;
    return (
      ["open", "submissions", "funded"].includes(gap.status) &&
      timeLeft > this.policy.minTimeLeftSeconds &&
      // optimistic bound: whole bounty; competitive reality is a share of it
      budget >= this.policy.minExpectedRewardUnits
    );
  }

  async runOnce(): Promise<{ submitted: number; skipped: number }> {
    // a gap accepting submissions may be "open" or already "submissions"
    const open = (await this.gap402.listGaps({ status: "open" })).gaps;
    const live = (await this.gap402.listGaps({ status: "submissions" })).gaps;
    const gaps = [...open, ...live];
    let submitted = 0;
    let skipped = 0;
    for (const view of gaps) {
      const gap = view.gap;
      if (!this.worthPursuing(gap)) {
        skipped++;
        continue;
      }
      const found = await this.provider.search(gap.claim, this.policy.maxSearchResults);
      const candidates = this.select(found, gap);
      for (const c of candidates) {
        const res = await this.gap402.submitEvidence(gap.id, {
          url: canonicalizeUrl(c.url),
          supplierAddress: this.address,
          supplierId: this.name,
          title: c.title,
          publisher: c.publisher,
          publishedAt: c.publishedAt,
          excerpt: c.excerpt,
          claimRelation: c.claimRelation ?? "unknown",
          sourceType: c.sourceType ?? "unknown",
          contentHash: contentHashOf(c.content ?? c.excerpt ?? c.url),
        });
        if (!(res as { duplicate?: boolean }).duplicate) submitted++;
      }
    }
    return { submitted, skipped };
  }
}

/** Generalist: submits everything that plausibly supports the claim. */
export class SearchSupplier extends BaseSupplier {
  readonly name = "search-supplier";
  protected select(candidates: CandidateSource[]): CandidateSource[] {
    return candidates.filter(
      (c) => c.claimRelation !== "contradicts" && c.sourceType !== "social",
    );
  }
}

/** Only submits official/primary sources (docs, press releases, filings). */
export class OfficialSourceSupplier extends BaseSupplier {
  readonly name = "official-source-supplier";
  protected select(candidates: CandidateSource[]): CandidateSource[] {
    return candidates.filter(
      (c) => c.sourceType === "official" || c.sourceType === "primary",
    );
  }
}

/** Only submits independent journalism/analysis — never the subject's own site. */
export class IndependentSourceSupplier extends BaseSupplier {
  readonly name = "independent-source-supplier";
  protected select(candidates: CandidateSource[]): CandidateSource[] {
    return candidates.filter((c) => c.sourceType === "independent");
  }
}
