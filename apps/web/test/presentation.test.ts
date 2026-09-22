import { describe, expect, it } from "vitest";
import {
  accounting,
  host,
  ratio,
  readableRequirements,
  register,
  safeUrl,
  utcDate,
} from "../lib/presentation";
import { fmtUsdc, type GapView, type SettlementPlan } from "../lib/api";

const plan = {
  distributableUnits: "47500",
  verifierFeeUnits: "2500",
  totalPaidUnits: "2500",
  refundUnits: "47500",
  payouts: [
    {
      submissionId: "verifier-fee",
      recipient: "verifier",
      amountUnits: "2500",
      shareBps: 500,
      explanation: { quality: 0, shareBps: 500, capped: false, belowMinPayout: false },
    },
  ],
  id: "plan",
  bountyId: "gap",
  algorithmVersion: "v1",
  settlementHash: "hash",
  createdAt: "2026-09-22",
} satisfies SettlementPlan;
describe("exact presentation accounting", () => {
  it("counts the existing verifier fee once when every source is rejected", () => {
    expect(accounting(plan, "50000")).toEqual({
      paid: 2500n,
      fee: 2500n,
      suppliers: 0n,
      refund: 47500n,
      total: 50000n,
      reconciled: true,
    });
  });
  it("detects missing, duplicated or inconsistent fee rows", () => {
    expect(accounting({ ...plan, payouts: [] }).reconciled).toBe(false);
    expect(
      accounting({ ...plan, payouts: [...plan.payouts, ...plan.payouts] }).reconciled,
    ).toBe(false);
    expect(accounting({ ...plan, totalPaidUnits: "1" }).reconciled).toBe(false);
  });
  it("never rounds monetary values through floating point", () => {
    expect(fmtUsdc("9007199254740993123456")).toBe("9007199254740993.123456");
    expect(ratio("9007199254740993123456", "18014398509481986246912")).toBe(50);
    expect(ratio("1", "3")).toBe(33.33);
    expect(ratio("0", "0")).toBe(0);
  });
});
describe("untrusted and unknown metadata", () => {
  it("only makes web URLs clickable", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,hello")).toBeUndefined();
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
  });
  it("keeps unknown source and date values readable", () => {
    expect(host("not a URL")).toBe("not a URL");
    expect(utcDate("unknown")).toBe("Unknown deadline");
    expect(utcDate("2026-09-22T12:00:00Z")).toBe("2026-09-22 12:00 UTC");
  });
  it("explains returned requirements without inventing defaults", () => {
    expect(
      readableRequirements({
        claim: "claim",
        minSupportScore: 600000,
        minIndependentSources: 3,
        rejectDuplicates: false,
      }),
    ).toEqual([
      { label: "Minimum support score", value: "600,000 / 1,000,000" },
      { label: "Minimum distinct qualifying domains", value: "3" },
      { label: "Reject duplicate evidence", value: "No" },
    ]);
  });
});
describe("market register", () => {
  const gap = (id: string, budget: string, status: string, claim: string): GapView => ({
    gap: {
      id,
      claim,
      budgetUnits: budget,
      status,
      question: claim,
      requirements: {},
      currency: "USDC",
      requesterAddress: "requester",
      verifierAddress: "verifier",
      deadline: "2026-09-22",
      createdAt: "2026-09-21",
    },
    runtime: {},
    submissionCount: 0,
  });
  it("sorts large budgets exactly without modifying API records", () => {
    const list = [
      gap("a", "9007199254740992", "open", "Launch"),
      gap("b", "9007199254740993", "settled", "Report"),
    ];
    expect(register(list, "", "all", "budget").map((g) => g.gap.id)).toEqual(["b", "a"]);
    expect(list.map((g) => g.gap.id)).toEqual(["a", "b"]);
  });
  it("searches real claims and ids, then combines lifecycle filtering", () => {
    const list = [gap("a", "1", "open", "Launch"), gap("b", "2", "settled", "Launch")];
    expect(register(list, "LAUNCH", "open", "deadline").map((g) => g.gap.id)).toEqual([
      "a",
    ]);
    expect(register(list, "b", "all", "deadline").map((g) => g.gap.id)).toEqual(["b"]);
    expect(register(list, "absent", "all", "deadline")).toEqual([]);
  });
});
