import { describe, expect, it } from "vitest";
import {
  evidenceRequirementSchema,
  evidenceSubmissionSchema,
  gapRequestSchema,
  settlementPlanSchema,
} from "../src/index.js";

const baseGap = {
  protocol: "gap402",
  version: "1",
  id: "gap_test1",
  question: "q?",
  claim: "c",
  requirements: { claim: "c" },
  budgetUnits: "50000",
  currency: "USDC",
  requester: { id: "r", kind: "service" },
  requesterAddress: "0x1000000000000000000000000000000000000001",
  verifierAddress: "0x2000000000000000000000000000000000000002",
  createdAt: "2026-09-17T00:00:00Z",
  deadline: "2026-09-17T01:00:00Z",
  status: "open",
};

describe("GapRequest schema", () => {
  it("accepts a valid request", () => {
    const g = gapRequestSchema.parse(baseGap);
    expect(g.id).toBe("gap_test1");
    expect(g.requesterAddress).toMatch(/^0x/);
  });

  it("rejects bad addresses and budgets", () => {
    expect(() =>
      gapRequestSchema.parse({ ...baseGap, requesterAddress: "0x123" }),
    ).toThrow();
    expect(() => gapRequestSchema.parse({ ...baseGap, budgetUnits: "0.05" })).toThrow();
    expect(() => gapRequestSchema.parse({ ...baseGap, budgetUnits: "-5" })).toThrow();
  });

  it("rejects unknown status", () => {
    expect(() => gapRequestSchema.parse({ ...baseGap, status: "bogus" })).toThrow();
  });
});

describe("EvidenceRequirement schema", () => {
  it("fills defaults", () => {
    const r = evidenceRequirementSchema.parse({ claim: "c" });
    expect(r.rejectDuplicates).toBe(true);
    expect(r.minSupportScore).toBe(500_000);
  });
});

describe("EvidenceSubmission schema", () => {
  const sub = {
    protocol: "gap402",
    version: "1",
    id: "sub_1",
    bountyId: "gap_test1",
    supplier: { id: "s", kind: "service" },
    supplierAddress: "0x3000000000000000000000000000000000000003",
    canonicalUrl: "https://example.com/a",
    retrievedAt: "2026-09-17T00:00:00Z",
    contentHash: `0x${"ab".repeat(32)}`,
    claimRelation: "supports",
    sourceType: "independent",
    submittedAt: "2026-09-17T00:00:00Z",
  };
  it("accepts a valid submission", () => {
    expect(evidenceSubmissionSchema.parse(sub).contentHash).toMatch(/^0x/);
  });
  it("rejects malformed contentHash", () => {
    expect(() =>
      evidenceSubmissionSchema.parse({ ...sub, contentHash: "deadbeef" }),
    ).toThrow();
  });
});

describe("SettlementPlan schema", () => {
  it("round-trips a minimal plan", () => {
    const plan = settlementPlanSchema.parse({
      protocol: "gap402",
      version: "1",
      id: "plan_1",
      bountyId: "gap_test1",
      algorithmVersion: "gap402-portfolio-v1",
      distributableUnits: "47500",
      verifierFeeUnits: "2500",
      payouts: [
        {
          submissionId: "sub_1",
          recipient: "0x3000000000000000000000000000000000000003",
          amountUnits: "47500",
          shareBps: 9500,
          explanation: {
            factors: {
              support: 1,
              provenance: 1,
              independence: 1,
              novelty: 1,
              freshness: 1,
            },
            quality: 1,
            shareBps: 9500,
            capped: false,
            belowMinPayout: false,
          },
        },
      ],
      totalPaidUnits: "50000",
      refundUnits: "0",
      settlementHash: `0x${"cd".repeat(32)}`,
      createdAt: "2026-09-17T00:00:00Z",
    });
    expect(plan.payouts[0]!.recipient).toMatch(/^0x/);
  });
});
