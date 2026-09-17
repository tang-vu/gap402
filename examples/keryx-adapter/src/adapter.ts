import { Gap402, type GapView } from "@gap402/sdk";
import type { EvidenceReceipt } from "@gap402/schemas";
import { formatUsdcAmount } from "@gap402/config";

/**
 * Reference Keryx adapter. Gap402 stays fully independent — this file shows
 * the ONLY surface a Keryx-style research pipeline needs:
 *
 *   Keryx BUY/SKIP pipeline
 *     -> evidence insufficiency detected   (detectGap)
 *     -> Gap402 bounty                     (openGap)
 *     -> EvidenceReceipt                   (awaitGap)
 *     -> merge evidence, continue answer   (mergeEvidence)
 *
 * No Keryx internals are imported; any agent can reuse this shape.
 */

export interface GapDetection {
  insufficient: boolean;
  coverageBps: number;
  unsupportedClaims: string[];
  /** Highest-value claim to convert into a bounty. */
  targetClaim?: string;
}

export interface KeryxAdapterOptions {
  /** Coverage below this (bps) counts as a gap. Default 7000 (70%). */
  coverageThresholdBps?: number;
  /** Default bounty in USDC base units. */
  defaultBudgetUnits?: bigint;
  deadlineSeconds?: number;
}

/** Minimal evidence shape the caller (Keryx) already has. */
export interface ExistingEvidence {
  claimSupported: string; // which claim this source supports, if any
  url: string;
  independent: boolean;
}

export class KeryxAdapter {
  constructor(
    private gap402: Gap402,
    private opts: KeryxAdapterOptions = {},
  ) {}

  /**
   * Decide whether the current evidence leaves a claim unsupported.
   * Coverage here = fraction of `claims` with >= 1 independent source.
   * Callers may substitute their own estimator — this stays intentionally
   * simple and deterministic.
   */
  detectGap(input: {
    question: string;
    claims: string[];
    currentEvidence: ExistingEvidence[];
  }): GapDetection {
    const threshold = this.opts.coverageThresholdBps ?? 7000;
    const unsupported = input.claims.filter(
      (c) => !input.currentEvidence.some((e) => e.claimSupported === c && e.independent),
    );
    const coverageBps =
      input.claims.length === 0
        ? 10_000
        : Math.round(
            ((input.claims.length - unsupported.length) / input.claims.length) * 10_000,
          );
    const insufficient = unsupported.length > 0 && coverageBps < threshold;
    return {
      insufficient,
      coverageBps,
      unsupportedClaims: unsupported,
      ...(insufficient ? { targetClaim: unsupported[0]! } : {}),
    };
  }

  /** Convert a detected gap into a funded Gap402 bounty. */
  async openGap(input: {
    question: string;
    claim: string;
    context?: string;
    budgetUnits?: bigint;
    requirements?: Record<string, unknown>;
  }): Promise<GapView> {
    const budget = input.budgetUnits ?? this.opts.defaultBudgetUnits ?? 50_000n;
    return this.gap402.createGap({
      question: input.question,
      claim: input.claim,
      context: input.context,
      budget: formatUsdcAmount(budget),
      deadlineSeconds: this.opts.deadlineSeconds ?? 3600,
      requirements: input.requirements ?? {},
    });
  }

  /** Wait for settlement; returns the Evidence Receipt (null on timeout). */
  async awaitGap(
    gapId: string,
    timeoutMs = 10 * 60 * 1000,
  ): Promise<EvidenceReceipt | null> {
    try {
      await this.gap402.waitForEvidence(gapId, { timeoutMs });
    } catch {
      return null;
    }
    return this.gap402.getReceiptByBounty(gapId);
  }

  /**
   * Fold accepted evidence back into the caller's evidence pool so its own
   * coverage analysis can be re-run. Returns items in ExistingEvidence shape.
   */
  mergeEvidence(receipt: EvidenceReceipt, targetClaim: string): ExistingEvidence[] {
    return receipt.acceptedEvidence.map((e) => ({
      claimSupported: targetClaim,
      url: e.url,
      independent: true,
    }));
  }
}
