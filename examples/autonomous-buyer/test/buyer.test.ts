import { describe, expect, it, vi } from "vitest";
import type { Gap402 } from "@gap402/sdk";
import { AutonomousBuyer, DEFAULT_BUDGET_POLICY } from "../src/buyer.js";

const input = { question: "q", claim: "c", evidence: [] };
const missing = async () => ({ coverageBps: 0, missing: ["c"] });

describe("buyer authorization policy", () => {
  it("does not replenish budget from an invalid receipt", async () => {
    const createGap = vi.fn().mockResolvedValue({ gap: { id: "gap_test" } });
    const client = {
      createGap,
      waitForEvidence: vi.fn().mockResolvedValue({ gap: { status: "settled" } }),
      getReceiptByBounty: vi.fn().mockResolvedValue({ refundUnits: "50000" }),
    } as unknown as Gap402;
    const buyer = new AutonomousBuyer(
      client,
      { ...DEFAULT_BUDGET_POLICY, maxTotalUnits: 50000n },
      missing,
    );
    await expect(buyer.ensureEvidence(input)).rejects.toThrow("receipt integrity");
    expect((await buyer.ensureEvidence(input)).funded).toBe(false);
    expect(createGap).toHaveBeenCalledTimes(1);
  });
  it("refuses amounts over automatic approval threshold before calling the API", async () => {
    const createGap = vi.fn();
    const buyer = new AutonomousBuyer(
      { createGap } as unknown as Gap402,
      { ...DEFAULT_BUDGET_POLICY, autoPayBelowUnits: 10000n },
      missing,
    );
    expect((await buyer.ensureEvidence({ ...input, budgetUnits: 20000n })).funded).toBe(
      false,
    );
    expect((await buyer.ensureEvidence({ ...input, budgetUnits: 0n })).funded).toBe(
      false,
    );
    expect(createGap).not.toHaveBeenCalled();
  });
  it("reserves across concurrent requests and retains reservation on ambiguous failure", async () => {
    const createGap = vi
      .fn()
      .mockRejectedValue(new Error("timeout after potential funding"));
    const buyer = new AutonomousBuyer(
      { createGap } as unknown as Gap402,
      { ...DEFAULT_BUDGET_POLICY, maxTotalUnits: 50000n },
      missing,
    );
    const results = await Promise.allSettled([
      buyer.ensureEvidence(input),
      buyer.ensureEvidence(input),
    ]);
    expect(createGap).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await buyer.ensureEvidence(input)).funded).toBe(false);
  });
});
