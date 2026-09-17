import { describe, it, expect } from "vitest";
import { buildSettlementPlan, qualityScore } from "../src/settle.js";
import type { EvidenceEvaluation, EvidenceSubmission } from "@gap402/schemas";

const VERIFIER = "0x1000000000000000000000000000000000000001" as const;

function addr(n: number): `0x${string}` {
  return `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
}

function sub(id: string, supplier: `0x${string}`): EvidenceSubmission {
  return {
    protocol: "gap402",
    version: "1",
    id,
    bountyId: "b1",
    supplier: { id: supplier, kind: "service" },
    supplierAddress: supplier,
    canonicalUrl: `https://example.com/${id}`,
    retrievedAt: "2026-09-17T00:00:00Z",
    contentHash: `0x${id.padEnd(64, "0").slice(0, 64)}` as `0x${string}`,
    claimRelation: "supports",
    sourceType: "independent",
    submittedAt: "2026-09-17T00:00:00Z",
  };
}

function ev(
  id: string,
  verdict: "accepted" | "rejected",
  s: Partial<EvidenceEvaluation["scores"]> = {},
): EvidenceEvaluation {
  return {
    protocol: "gap402",
    version: "1",
    id: `e-${id}`,
    submissionId: id,
    bountyId: "b1",
    verdict,
    rejectReasons: verdict === "rejected" ? ["test"] : [],
    scores: {
      support: 900_000,
      provenance: 800_000,
      independence: 900_000,
      novelty: 900_000,
      freshness: 900_000,
      ...s,
    },
    confidence: 900_000,
    checks: [],
    evaluatorVersion: "test",
    evaluatedAt: "2026-09-17T00:00:00Z",
  };
}

describe("qualityScore", () => {
  it("multiplies factors with fixed-point scaling", () => {
    expect(qualityScore(ev("x", "accepted"))).toBeGreaterThan(0n);
    expect(qualityScore(ev("x", "accepted", { support: 1_000_000 }))).toBeGreaterThan(
      qualityScore(ev("x", "accepted", { support: 100_000 })),
    );
  });
  it("is zero when any factor is zero", () => {
    expect(qualityScore(ev("x", "accepted", { novelty: 0 }))).toBe(0n);
  });
});

describe("buildSettlementPlan", () => {
  it("splits the bounty proportionally to quality", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 50_000n, // 0.05 USDC
      submissions: [sub("a", addr(1)), sub("b", addr(2))],
      evaluations: [
        ev("a", "accepted", { support: 900_000 }),
        ev("b", "accepted", { support: 600_000 }),
      ],
      policy: { verifierAddress: VERIFIER },
      createdAt: "2026-09-17T00:00:00Z",
    });
    const a = plan.payouts.find((p) => p.recipient === addr(1))!;
    const b = plan.payouts.find((p) => p.recipient === addr(2))!;
    expect(BigInt(a.amountUnits)).toBeGreaterThan(BigInt(b.amountUnits));
    const sum = plan.payouts.reduce((s, p) => s + BigInt(p.amountUnits), 0n);
    expect(sum + BigInt(plan.refundUnits)).toBe(50_000n);
  });

  it("rejected evidence receives nothing", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 50_000n,
      submissions: [sub("a", addr(1)), sub("b", addr(2))],
      evaluations: [ev("a", "accepted"), ev("b", "rejected")],
      policy: { verifierAddress: VERIFIER },
      createdAt: "2026-09-17T00:00:00Z",
    });
    expect(plan.payouts.find((p) => p.recipient === addr(2))).toBeUndefined();
  });

  it("aggregates multiple accepted submissions per recipient", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 50_000n,
      submissions: [sub("a", addr(1)), sub("a2", addr(1))],
      evaluations: [ev("a", "accepted"), ev("a2", "accepted")],
      policy: { verifierAddress: VERIFIER },
      createdAt: "2026-09-17T00:00:00Z",
    });
    const lines = plan.payouts.filter((p) => p.recipient === addr(1));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.explanation.note).toContain("aggregated 2");
  });

  it("enforces the max-share cap", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 100_000n,
      submissions: [sub("a", addr(1)), sub("b", addr(2))],
      evaluations: [
        ev("a", "accepted", { support: 1_000_000 }),
        ev("b", "accepted", { support: 10_000 }),
      ],
      policy: { verifierAddress: VERIFIER, maxShareBps: 7000 },
      createdAt: "2026-09-17T00:00:00Z",
    });
    const a = plan.payouts.find((p) => p.recipient === addr(1))!;
    const distributable = BigInt(plan.distributableUnits);
    expect(BigInt(a.amountUnits)).toBeLessThanOrEqual((distributable * 7000n) / 10000n);
    expect(a.explanation.capped).toBe(true);
  });

  it("drops below-min payouts and redistributes", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 10_000n,
      submissions: [sub("a", addr(1)), sub("b", addr(2))],
      evaluations: [
        ev("a", "accepted"),
        ev("b", "accepted", { support: 1_000 }), // negligible
      ],
      policy: {
        verifierAddress: VERIFIER,
        minPayoutUnits: 100n,
        maxShareBps: 10_000,
      },
      createdAt: "2026-09-17T00:00:00Z",
    });
    const b = plan.payouts.find((p) => p.recipient === addr(2));
    expect(b === undefined || BigInt(b.amountUnits) >= 100n).toBe(true);
  });

  it("refunds everything when nothing qualifies", () => {
    const plan = buildSettlementPlan({
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 50_000n,
      submissions: [sub("a", addr(1))],
      evaluations: [ev("a", "rejected")],
      policy: { verifierAddress: VERIFIER },
      createdAt: "2026-09-17T00:00:00Z",
    });
    const supplierLines = plan.payouts.filter((p) => p.submissionId !== "verifier-fee");
    expect(supplierLines).toHaveLength(0);
    expect(BigInt(plan.refundUnits)).toBe(50_000n - BigInt(plan.verifierFeeUnits));
  });

  it("is deterministic", () => {
    const input = {
      planId: "p1",
      bountyId: "b1",
      bountyUnits: 77_777n,
      submissions: [sub("a", addr(1)), sub("b", addr(2)), sub("c", addr(3))],
      evaluations: [
        ev("a", "accepted", { support: 950_000, freshness: 800_000 }),
        ev("b", "accepted", { support: 900_000 }),
        ev("c", "accepted", { support: 300_000, novelty: 500_000 }),
      ],
      policy: { verifierAddress: VERIFIER },
      createdAt: "2026-09-17T00:00:00Z",
    };
    const p1 = buildSettlementPlan(input);
    const p2 = buildSettlementPlan(input);
    expect(p1).toEqual(p2);
    expect(p1.settlementHash).toBe(p2.settlementHash);
  });

  it("property: payouts + refund always equal bounty (randomized)", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i++) {
      const n = 1 + Math.floor(rand() * 8);
      const bounty = BigInt(1 + Math.floor(rand() * 1_000_000));
      const subs = Array.from({ length: n }, (_, j) => sub(`s${j}`, addr(1 + j)));
      const evals = subs.map((s) =>
        ev(s.id, rand() > 0.3 ? "accepted" : "rejected", {
          support: Math.floor(rand() * 1_000_000),
          provenance: Math.floor(rand() * 1_000_000),
          independence: Math.floor(rand() * 1_000_000),
          novelty: Math.floor(rand() * 1_000_000),
          freshness: Math.floor(rand() * 1_000_000),
        }),
      );
      const plan = buildSettlementPlan({
        planId: "p",
        bountyId: "b1",
        bountyUnits: bounty,
        submissions: subs,
        evaluations: evals,
        policy: {
          verifierAddress: VERIFIER,
          verifierFeeBps: Math.floor(rand() * 1000),
          minPayoutUnits: BigInt(Math.floor(rand() * 500)),
          maxShareBps: 3000 + Math.floor(rand() * 7000),
        },
        createdAt: "2026-09-17T00:00:00Z",
      });
      const sum = plan.payouts.reduce((s, p) => s + BigInt(p.amountUnits), 0n);
      expect(sum + BigInt(plan.refundUnits)).toBe(bounty);
      const recips = plan.payouts.map((p) => p.recipient);
      expect(new Set(recips).size).toBe(recips.length);
      for (const p of plan.payouts) {
        expect(BigInt(p.amountUnits)).toBeGreaterThan(0n);
      }
      expect(plan.settlementHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });
});
