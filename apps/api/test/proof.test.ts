import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeReceiptHash,
  computeSettlementHash,
  verifyBundle,
} from "@gap402/protocol";
import { resolveNetwork } from "@gap402/config";
import { contentHashOf } from "@gap402/evidence";
import { runDemo } from "../src/demo.js";
import { buildServer } from "../src/server.js";
import { GapService } from "../src/service.js";
import { Store } from "../src/store.js";

afterEach(() => vi.unstubAllEnvs());

describe("portable proof and isolated demo", () => {
  it("accepts useful sources, refuses stale evidence, deduplicates and balances exactly", async () => {
    const result = await runDemo("mixed");
    expect(result.actualSpendUnits).toBe("0");
    expect(result.duplicatePrevented).toBe(true);
    expect(result.receipt?.acceptedEvidence).toHaveLength(2);
    expect(result.receipt?.rejectedEvidence).toHaveLength(1);
    expect(result.receipt?.evaluatorVersion).toContain("mock-v1");
    expect(verifyBundle(result).valid).toBe(true);
    const corrupted = structuredClone(result);
    corrupted.receipt!.refundUnits = "999999";
    expect(verifyBundle(corrupted).valid).toBe(false);
  });
  it("rejects recipient drift even when an attacker recomputes all hashes", async () => {
    const result = await runDemo("mixed");
    result.plan!.payouts[0]!.recipient = "0x9999999999999999999999999999999999999999";
    result.plan!.settlementHash = computeSettlementHash(result.plan!);
    result.receipt!.settlementHash = result.plan!.settlementHash;
    result.receipt!.receiptHash = computeReceiptHash(result.receipt!);
    expect(verifyBundle(result).checks.payouts).toBe(false);
  });
  it("rejects swapped specifications and duplicate receipt evidence", async () => {
    const result = await runDemo("mixed");
    result.gap.claim = "Changed claim";
    expect(verifyBundle(result).valid).toBe(false);
    const another = await runDemo("mixed");
    another.receipt!.rejectedEvidence.push({
      submissionId: another.receipt!.acceptedEvidence[0]!.submissionId,
      supplierAddress: another.receipt!.acceptedEvidence[0]!.supplierAddress,
      reasons: ["duplicate"],
    });
    another.receipt!.receiptHash = computeReceiptHash(another.receipt!);
    expect(verifyBundle(another).checks.uniqueEvidence).toBe(false);
    expect(verifyBundle(null).valid).toBe(false);
  });
  it("abstains with rejected evidence and blocks unmet portfolio requirements", async () => {
    const rejected = await runDemo("rejected");
    expect(rejected.receipt?.acceptedEvidence).toHaveLength(0);
    expect(rejected.plan?.payouts.every((p) => p.submissionId === "verifier-fee")).toBe(
      true,
    );
    expect(verifyBundle(rejected).valid).toBe(true);
    const insufficient = await runDemo("insufficient");
    expect(insufficient.plan).toBeNull();
    expect(insufficient.receipt).toBeNull();
    expect(insufficient.blockedReason).toContain("2/3");
  });
  it("exposes demo without mutating the live market and reports execution mode", async () => {
    vi.stubEnv("GAP402_WRITE_TOKEN", "test-token");
    const store = new Store("sqlite::memory:");
    const app = await buildServer({ store, network: resolveNetwork("testnet") });
    try {
      expect((await app.inject({ url: "/api/health" })).json().settlementMode).toBe(
        "offchain-simulation",
      );
      const demo = await app.inject({
        method: "POST",
        url: "/api/demo",
        payload: { scenario: "mixed" },
      });
      expect(demo.statusCode).toBe(200);
      expect(verifyBundle(demo.json()).valid).toBe(true);
      expect((await app.inject({ url: "/api/gaps" })).json().gaps).toHaveLength(0);
      expect(
        (await app.inject({ method: "POST", url: "/api/gaps", payload: {} })).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/gaps",
            headers: { authorization: "Bearer test-token" },
            payload: { question: "q", claim: "c", budgetUnits: "50000" },
          })
        ).statusCode,
      ).toBe(503);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/demo",
            payload: { scenario: "arbitrary" },
          })
        ).statusCode,
      ).toBe(400);
    } finally {
      await app.close();
      store.close();
    }
  });
  it("pins the target claim and refuses inconsistent content commitments", () => {
    const store = new Store("sqlite::memory:");
    try {
      const address = "0x1000000000000000000000000000000000000001";
      const service = new GapService(store, address);
      const { gap } = service.createGap({
        question: "q",
        claim: "true target",
        requirements: { claim: "swapped target" },
        budgetUnits: "50000",
        requesterAddress: address,
      });
      expect(gap.requirements.claim).toBe(gap.claim);
      service.setStatus(gap.id, "open");
      expect(() =>
        service.submitEvidence(gap.id, {
          url: "https://example.org",
          content: "original",
          contentHash: contentHashOf("forged"),
          supplierAddress: address,
        }),
      ).toThrow("content hash");
      const result = service.submitEvidence(gap.id, {
        url: "https://example.org",
        content: "full original",
        excerpt: "short",
        supplierAddress: address,
      });
      expect(result.submission.contentHash).toBe(contentHashOf("full original"));
      expect(result.submission).not.toHaveProperty("content");
    } finally {
      store.close();
    }
  });
  it("can accept more evidence after an insufficient portfolio is evaluated", async () => {
    const store = new Store("sqlite::memory:");
    try {
      const address = "0x1000000000000000000000000000000000000001";
      const service = new GapService(store, address);
      const { gap } = service.createGap({
        question: "q",
        claim: "Acme launched WidgetNet",
        budgetUnits: "50000",
        requesterAddress: address,
        requirements: { minIndependentSources: 2, minSupportScore: 100000 },
      });
      service.setStatus(gap.id, "open");
      service.submitEvidence(gap.id, {
        url: "https://one.example.org",
        title: gap.claim,
        excerpt: gap.claim,
        supplierAddress: address,
      });
      await service.evaluateGap(gap.id);
      expect(() => service.buildPlan(gap.id)).toThrow("1/2");
      service.submitEvidence(gap.id, {
        url: "https://two.example.net",
        title: gap.claim,
        excerpt: gap.claim + " independently reported",
        supplierAddress: address,
      });
      expect(service.getGap(gap.id)?.status).toBe("submissions");
      await service.evaluateGap(gap.id);
      expect(service.buildPlan(gap.id).bountyId).toBe(gap.id);
    } finally {
      store.close();
    }
  });
});
