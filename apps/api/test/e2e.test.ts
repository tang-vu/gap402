import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { Store } from "../src/store.js";
import { resolveNetwork } from "@gap402/config";
import { computeReceiptHash } from "@gap402/protocol";
import { Gap402 } from "@gap402/sdk";
import { MockSemanticProvider } from "@gap402/verifier";
import type { FastifyInstance } from "fastify";
import type { AddressInfo } from "node:net";

/**
 * End-to-end over real HTTP: a live Fastify server + the real Gap402 SDK
 * client — create → submit (incl. duplicate) → evaluate → finalize →
 * receipt → consume. Offchain mode (no bounty contract configured).
 */

const VERIFIER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const; // anvil #1, local only
const REQUESTER = "0x1000000000000000000000000000000000000001" as const;
const SUPPLIER_A = "0x2000000000000000000000000000000000000002" as const;
const SUPPLIER_B = "0x3000000000000000000000000000000000000003" as const;

let app: FastifyInstance;
let api: string;
let gap: Gap402;

beforeAll(async () => {
  app = await buildServer({
    store: new Store("sqlite::memory:"),
    network: resolveNetwork("local"),
    verifierKey: VERIFIER_KEY,
    semantic: new MockSemanticProvider(),
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  api = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  gap = new Gap402({
    api,
    requester: { id: "e2e-buyer", kind: "service", address: REQUESTER },
  });
});

afterAll(async () => {
  await app.close();
});

describe("e2e: sdk client over real http", () => {
  it("runs the full lifecycle", async () => {
    expect(await gap.health()).toMatchObject({ ok: true, network: "local" });

    const created = await gap.createGap({
      question: "Has Acme Corp deployed WidgetNet in Vietnam?",
      claim: "Acme Corp deployed WidgetNet in Vietnam before 2026-09-01",
      budget: "0.05",
      deadlineSeconds: 3600,
      requirements: { minSupportScore: 100_000 },
    });
    const gapId = created.gap.id;
    expect(created.runtime.specHash).toMatch(/^0x[0-9a-f]{64}$/);

    const s1 = await gap.submitEvidence(gapId, {
      url: "https://acme.example.com/press/widgetnet-vietnam",
      title: "Acme launches WidgetNet in Vietnam",
      publishedAt: "2026-09-10T00:00:00Z",
      excerpt: "Acme Corp deployed WidgetNet in Vietnam before September 2026.",
      claimRelation: "supports",
      sourceType: "official",
      supplierAddress: SUPPLIER_A,
    });
    expect(s1.duplicate).toBe(false);

    const s2 = await gap.submitEvidence(gapId, {
      url: "https://vnnews.example.net/acme-widgetnet",
      title: "Acme confirms Vietnam rollout",
      publishedAt: "2026-09-11T00:00:00Z",
      excerpt:
        "Independent reporting confirms the WidgetNet service went live for Acme Corp's Vietnam operation in late August 2026.",
      claimRelation: "supports",
      sourceType: "independent",
      supplierAddress: SUPPLIER_B,
    });
    expect(s2.duplicate).toBe(false);

    // exact URL repost must dedup, not double-pay
    const dup = await gap.submitEvidence(gapId, {
      url: "https://acme.example.com/press/widgetnet-vietnam",
      supplierAddress: SUPPLIER_B,
    });
    expect(dup.duplicate).toBe(true);

    const { evaluations } = await gap.evaluateGap(gapId);
    expect(evaluations.filter((e) => e.verdict === "accepted").length).toBe(2);

    const { plan, receipt } = await gap.finalizeGap(gapId);
    const paid = plan.payouts.reduce((s, p) => s + BigInt(p.amountUnits), 0n);
    expect(paid + BigInt(plan.refundUnits)).toBe(BigInt(created.gap.budgetUnits));
    expect(computeReceiptHash(receipt)).toBe(receipt.receiptHash);

    const byBounty = await gap.getReceiptByBounty(gapId);
    expect(byBounty?.id).toBe(receipt.id);

    const settled = await gap.waitForEvidence(gapId, {
      intervalMs: 50,
      timeoutMs: 10_000,
    });
    expect(settled.gap.status).toBe("settled");

    const consumed = await gap.consumeGap(gapId);
    expect(consumed.gap.status).toBe("consumed");

    // terminal: a second finalize must be rejected
    await expect(gap.finalizeGap(gapId)).rejects.toThrow(/409/);
  });
});
