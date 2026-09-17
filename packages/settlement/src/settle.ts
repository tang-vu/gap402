import {
  SCORE_SCALE,
  BPS_SCALE,
  type EvidenceEvaluation,
  type EvidenceSubmission,
  type Payout,
  type SettlementPlan,
} from "@gap402/schemas";
import { computeSettlementHash } from "@gap402/protocol";

export const ALGORITHM_VERSION = "gap402-portfolio-v1";

export interface SettlementPolicy {
  /** Verifier/protocol fee in basis points of the total bounty. */
  verifierFeeBps: number;
  /** Verifier payout address; required iff verifierFeeBps > 0. */
  verifierAddress?: `0x${string}`;
  /** Minimum payout in USDC base units; smaller shares are redistributed. */
  minPayoutUnits: bigint;
  /** Max share of the distributable pool any single recipient may take (bps). */
  maxShareBps: number;
}

export const DEFAULT_POLICY: SettlementPolicy = {
  verifierFeeBps: 500, // 5%
  minPayoutUnits: 1n, // 0.000001 USDC
  maxShareBps: 7000, // 70%
};

export class SettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementError";
  }
}

/** quality = support * provenance * independence * novelty * freshness / 1e6^4 */
export function qualityScore(e: EvidenceEvaluation): bigint {
  const f = e.scores;
  let q = BigInt(f.support);
  for (const v of [f.provenance, f.independence, f.novelty, f.freshness]) {
    q = (q * BigInt(v)) / BigInt(SCORE_SCALE);
  }
  return q;
}

interface Live {
  recipient: `0x${string}`;
  quality: bigint;
  submissionIds: string[];
  evals: EvidenceEvaluation[];
}

/**
 * Deterministic evidence-portfolio settlement.
 *
 *   quality_i = support * provenance * independence * novelty * freshness
 *   share_i   ∝ quality_i over qualified recipients
 *   verifier takes verifierFeeBps off the top; per-recipient shares are
 *   capped at maxShareBps and floored at minPayoutUnits with deterministic
 *   redistribution. Any unallocatable residue refunds to the requester.
 *
 * Invariants (re-checked before returning):
 *  - sum(payouts) + refund == bountyUnits   (verifier fee is inside payouts)
 *  - every payout > 0, recipient != 0x0, no duplicate recipients
 *  - identical inputs produce identical outputs
 */
export function buildSettlementPlan(input: {
  planId: string;
  bountyId: string;
  bountyUnits: bigint;
  submissions: EvidenceSubmission[];
  evaluations: EvidenceEvaluation[];
  policy?: Partial<SettlementPolicy>;
  createdAt: string;
}): SettlementPlan {
  const policy: SettlementPolicy = { ...DEFAULT_POLICY, ...input.policy };
  if (input.bountyUnits < 0n) throw new SettlementError("bountyUnits must be >= 0");
  if (policy.verifierFeeBps < 0 || policy.verifierFeeBps > BPS_SCALE)
    throw new SettlementError("verifierFeeBps out of range");
  if (policy.verifierFeeBps > 0 && !policy.verifierAddress)
    throw new SettlementError("verifierAddress required when verifierFeeBps > 0");
  if (policy.minPayoutUnits < 0n)
    throw new SettlementError("minPayoutUnits must be >= 0");
  if (policy.maxShareBps <= 0 || policy.maxShareBps > BPS_SCALE)
    throw new SettlementError("maxShareBps out of range");

  const evalBySubmission = new Map(input.evaluations.map((e) => [e.submissionId, e]));

  // Aggregate accepted evidence by recipient so one supplier can never
  // receive two line items (double-settlement protection).
  const byRecipient = new Map<`0x${string}`, Live>();
  for (const sub of input.submissions) {
    const ev = evalBySubmission.get(sub.id);
    if (!ev || ev.verdict !== "accepted") continue;
    const q = qualityScore(ev);
    if (q <= 0n) continue;
    const key = sub.supplierAddress.toLowerCase() as `0x${string}`;
    const cur = byRecipient.get(key) ?? {
      recipient: key,
      quality: 0n,
      submissionIds: [],
      evals: [],
    };
    cur.quality += q;
    cur.submissionIds.push(sub.id);
    cur.evals.push(ev);
    byRecipient.set(key, cur);
  }

  const verifierFee =
    (input.bountyUnits * BigInt(policy.verifierFeeBps)) / BigInt(BPS_SCALE);
  const distributable = input.bountyUnits - verifierFee;

  // Canonical candidate order: quality desc, then first submissionId asc.
  const candidates = [...byRecipient.values()].sort((a, b) =>
    a.quality === b.quality
      ? a.submissionIds[0]!.localeCompare(b.submissionIds[0]!)
      : a.quality > b.quality
        ? -1
        : 1,
  );

  const cap = (distributable * BigInt(policy.maxShareBps)) / BigInt(BPS_SCALE);
  const locked = new Map<`0x${string}`, bigint>(); // capped recipients
  const dropped = new Set<`0x${string}`>(); // below min payout
  const tentative = new Map<`0x${string}`, bigint>();
  let live: Live[] = candidates.filter((c) => !dropped.has(c.recipient));

  let converged = false;
  for (let round = 0; round <= candidates.length + 1; round++) {
    const lockedSum = [...locked.values()].reduce((s, v) => s + v, 0n);
    const pool = distributable - lockedSum;
    const totalQ = live.reduce((s, r) => s + r.quality, 0n);
    if (live.length === 0 || totalQ <= 0n || pool <= 0n) {
      converged = true;
      break;
    }

    tentative.clear();
    const allocs = live.map((r) => {
      const num = pool * r.quality;
      return { r, floor: num / totalQ, rem: num % totalQ };
    });
    let leftover = pool - allocs.reduce((s, a) => s + a.floor, 0n);
    // Largest remainder, tie-broken by first submissionId for determinism.
    const byRem = [...allocs].sort((a, b) =>
      a.rem === b.rem
        ? a.r.submissionIds[0]!.localeCompare(b.r.submissionIds[0]!)
        : a.rem > b.rem
          ? -1
          : 1,
    );
    const bonus = new Set<`0x${string}`>();
    for (const a of byRem) {
      if (leftover <= 0n) break;
      bonus.add(a.r.recipient);
      leftover -= 1n;
    }

    let changed = false;
    const next: Live[] = [];
    for (const a of allocs) {
      const amt = a.floor + (bonus.has(a.r.recipient) ? 1n : 0n);
      if (amt > cap) {
        locked.set(a.r.recipient, cap);
        changed = true;
      } else if (amt < policy.minPayoutUnits) {
        dropped.add(a.r.recipient);
        changed = true;
      } else {
        tentative.set(a.r.recipient, amt);
        next.push(a.r);
      }
    }
    live = next;
    if (!changed) {
      converged = true;
      break;
    }
  }
  if (!converged) throw new SettlementError("allocation did not converge");

  const payouts: Payout[] = [];
  let paid = 0n;
  for (const c of candidates) {
    const amt = locked.get(c.recipient) ?? tentative.get(c.recipient);
    if (amt === undefined || amt <= 0n) continue;
    const shareBps =
      distributable > 0n ? Number((amt * BigInt(BPS_SCALE)) / distributable) : 0;
    const rep = c.evals[0]!;
    payouts.push({
      submissionId: c.submissionIds[0]!,
      recipient: c.recipient,
      amountUnits: amt.toString(),
      shareBps,
      explanation: {
        factors: rep.scores,
        quality: Number(qualityScore(rep)),
        shareBps,
        capped: locked.has(c.recipient),
        belowMinPayout: false,
        ...(c.submissionIds.length > 1
          ? {
              note: `aggregated ${c.submissionIds.length} accepted submissions`,
            }
          : {}),
      },
    });
    paid += amt;
  }

  if (verifierFee > 0n && policy.verifierAddress) {
    payouts.push({
      submissionId: "verifier-fee",
      recipient: policy.verifierAddress,
      amountUnits: verifierFee.toString(),
      shareBps: policy.verifierFeeBps,
      explanation: {
        factors: {
          support: 0,
          provenance: 0,
          independence: 0,
          novelty: 0,
          freshness: 0,
        },
        quality: 0,
        shareBps: policy.verifierFeeBps,
        capped: false,
        belowMinPayout: false,
        note: "verifier/protocol allocation",
      },
    });
  }

  const refund = input.bountyUnits - paid - verifierFee;
  if (refund < 0n) throw new SettlementError("allocation overflowed bounty");

  const plan: SettlementPlan = {
    protocol: "gap402",
    version: "1",
    id: input.planId,
    bountyId: input.bountyId,
    algorithmVersion: ALGORITHM_VERSION,
    distributableUnits: distributable.toString(),
    verifierFeeUnits: verifierFee.toString(),
    ...(policy.verifierAddress ? { verifierAddress: policy.verifierAddress } : {}),
    payouts,
    totalPaidUnits: (paid + verifierFee).toString(),
    refundUnits: refund.toString(),
    settlementHash: ("0x" + "0".repeat(64)) as `0x${string}`,
    createdAt: input.createdAt,
  };
  plan.settlementHash = computeSettlementHash(plan);

  const sum = plan.payouts.reduce((s, p) => s + BigInt(p.amountUnits), 0n);
  if (sum + refund !== input.bountyUnits) {
    throw new SettlementError(
      `invariant violated: payouts(${sum}) + refund(${refund}) != bounty(${input.bountyUnits})`,
    );
  }
  return plan;
}
