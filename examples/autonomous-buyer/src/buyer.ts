import { Gap402, type GapView } from "@gap402/sdk";
import { parseUsdcAmount, formatUsdcAmount } from "@gap402/config";
import type { EvidenceReceipt } from "@gap402/schemas";
import { computeSpecHash, verifyReceipt } from "@gap402/protocol";

/**
 * Reference autonomous buyer. Given an evidence-sensitive question it:
 *  1. estimates evidence coverage over a set of candidate sources,
 *  2. finds the highest-value unsupported claim,
 *  3. creates a Gap402 bounty under a strict budget policy,
 *  4. waits for settlement and consumes the Evidence Receipt.
 *
 * Coverage estimation is intentionally a pluggable heuristic — production
 * agents should inject their own researcher/retriever.
 */

export interface BudgetPolicy {
  /** Hard cap on total spend across all bounties, in USDC units. */
  maxTotalUnits: bigint;
  /** Hard cap per single bounty. */
  maxBountyUnits: bigint;
  /** Only auto-fund bounties at or below this amount. */
  autoPayBelowUnits: bigint;
  /** Minimum seconds the bounty must leave suppliers. */
  minDeadlineSeconds: number;
  /** Maximum seconds before the agent gives up waiting. */
  waitTimeoutMs: number;
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  maxTotalUnits: 200_000n, // 0.20 USDC
  maxBountyUnits: 50_000n, // 0.05 USDC
  autoPayBelowUnits: 50_000n,
  minDeadlineSeconds: 300,
  waitTimeoutMs: 10 * 60 * 1000,
};

export interface EvidenceItem {
  url: string;
  supports: boolean; // does this source support the target claim?
  independent: boolean;
  publishedAt?: string;
}

export type CoverageEstimator = (input: {
  question: string;
  claim: string;
  evidence: EvidenceItem[];
}) => Promise<{ coverageBps: number; missing: string[] }>;

/** Conservative keyword-overlap estimator (deterministic, dependency-free). */
export const heuristicCoverage: CoverageEstimator = async ({ claim, evidence }) => {
  const terms = claim
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const supporting = evidence.filter((e) => e.supports);
  const independent = new Set(supporting.filter((e) => e.independent).map((e) => e.url));
  const covered = new Set<string>();
  for (const e of supporting) {
    const text = e.url.toLowerCase();
    for (const t of terms) if (text.includes(t)) covered.add(t);
  }
  const base = terms.length ? covered.size / terms.length : 0;
  const diversity = Math.min(1, independent.size / 2);
  const coverageBps = Math.round(10_000 * base * 0.5 + 10_000 * diversity * 0.5);
  const missing = terms.filter((t) => !covered.has(t));
  return { coverageBps, missing };
};

export interface BuyerResult {
  funded: boolean;
  reason?: string | undefined;
  gapId?: string | undefined;
  receipt?: EvidenceReceipt | undefined;
  coverageBeforeBps: number;
  coverageAfterBps?: number | undefined;
}

export class AutonomousBuyer {
  private spent = 0n;

  constructor(
    private gap402: Gap402,
    private policy: BudgetPolicy = DEFAULT_BUDGET_POLICY,
    private coverage: CoverageEstimator = heuristicCoverage,
  ) {}

  /**
   * Attempt to close an evidence gap for `claim`. Returns without spending
   * when coverage already suffices or policy would be violated.
   */
  async ensureEvidence(input: {
    question: string;
    claim: string;
    context?: string;
    evidence: EvidenceItem[];
    coverageThresholdBps?: number;
    budgetUnits?: bigint;
    deadlineSeconds?: number;
    requirements?: Record<string, unknown>;
  }): Promise<BuyerResult> {
    const threshold = input.coverageThresholdBps ?? 7000;
    const before = await this.coverage({
      question: input.question,
      claim: input.claim,
      evidence: input.evidence,
    });
    if (before.coverageBps >= threshold) {
      return {
        funded: false,
        reason: `coverage ${before.coverageBps / 100}% already >= ${threshold / 100}%`,
        coverageBeforeBps: before.coverageBps,
      };
    }

    const budget = input.budgetUnits ?? this.policy.maxBountyUnits;
    if (budget <= 0n || budget > this.policy.autoPayBelowUnits) {
      return {
        funded: false,
        reason: "budget outside automatic payment policy",
        coverageBeforeBps: before.coverageBps,
      };
    }
    if (budget > this.policy.maxBountyUnits) {
      return {
        funded: false,
        reason: `budget ${formatUsdcAmount(budget)} exceeds per-bounty cap ${formatUsdcAmount(this.policy.maxBountyUnits)}`,
        coverageBeforeBps: before.coverageBps,
      };
    }
    if (this.spent + budget > this.policy.maxTotalUnits) {
      return {
        funded: false,
        reason: `spend cap reached (${formatUsdcAmount(this.spent)} of ${formatUsdcAmount(this.policy.maxTotalUnits)})`,
        coverageBeforeBps: before.coverageBps,
      };
    }
    const deadlineSeconds = Math.max(
      input.deadlineSeconds ?? 3600,
      this.policy.minDeadlineSeconds,
    );

    // Reserve before the first funding await: concurrent calls share the cap.
    // Retain the reservation on ambiguous network errors; reconcile before retrying.
    this.spent += budget;
    const view = await this.gap402.createGap({
      question: input.question,
      claim: input.claim,
      context: input.context,
      budget: formatUsdcAmount(budget),
      deadlineSeconds,
      requirements: input.requirements ?? {},
    });

    const settled: GapView = await this.gap402.waitForEvidence(view.gap.id, {
      timeoutMs: this.policy.waitTimeoutMs,
    });
    const receipt = (await this.gap402.getReceiptByBounty(view.gap.id)) ?? undefined;
    if (receipt) {
      if (
        !verifyReceipt(receipt).valid ||
        receipt.bountyId !== view.gap.id ||
        receipt.requestHash !== computeSpecHash(view.gap) ||
        BigInt(receipt.totalPaidUnits) + BigInt(receipt.refundUnits) !== budget
      ) {
        throw new Error(
          "receipt integrity or bounty binding failed; budget remains reserved",
        );
      }
      const refund = BigInt(receipt.refundUnits);
      this.spent -= refund; // unspent residue returns to budget
    }

    const merged: EvidenceItem[] = [
      ...input.evidence,
      ...(receipt?.acceptedEvidence ?? []).map((e) => ({
        url: e.url,
        supports: true,
        independent: e.scores.independence >= 800_000,
      })),
    ];
    const after = await this.coverage({
      question: input.question,
      claim: input.claim,
      evidence: merged,
    });

    return {
      funded: true,
      gapId: view.gap.id,
      receipt,
      coverageBeforeBps: before.coverageBps,
      coverageAfterBps: after.coverageBps,
    };
  }
}

export { parseUsdcAmount };
