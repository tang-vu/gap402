import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
import { buildServer } from "../src/server.js";
import { Store } from "../src/store.js";
import { resolveNetwork } from "@gap402/config";
import type { FastifyInstance } from "fastify";

const REQUESTER = "0x1000000000000000000000000000000000000001";
const VERIFIER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // anvil #1 (local only)
const SUPPLIER_A = "0x2000000000000000000000000000000000000002";
const SUPPLIER_B = "0x3000000000000000000000000000000000000003";

let app: FastifyInstance;
afterEach(() => vi.useRealTimers());

beforeAll(async () => {
  app = await buildServer({
    store: new Store("sqlite::memory:"),
    network: resolveNetwork("local"),
    verifierKey: VERIFIER_KEY,
  });
});

afterAll(async () => {
  await app.close();
});

async function createGap() {
  const res = await app.inject({
    method: "POST",
    url: "/api/gaps",
    payload: {
      question: "Has Acme Corp deployed WidgetNet in Vietnam?",
      claim: "Acme Corp deployed WidgetNet in Vietnam before 2026-09-01",
      requirements: {
        maxSourceAgeSeconds: 30 * 86400,
        minSupportScore: 600000,
      },
      budgetUnits: "50000",
      requester: { address: REQUESTER, id: "buyer-agent", kind: "service" },
      deadlineSeconds: 3600,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe("gap lifecycle", () => {
  it("creates a gap (offchain mode: no contract configured)", async () => {
    const { gap, runtime } = await createGap();
    expect(gap.status).toBe("open");
    expect(gap.budgetUnits).toBe("50000");
    expect(runtime.specHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("rejects invalid create payloads", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/gaps",
      payload: { question: "", claim: "x", budgetUnits: "abc" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts submissions from multiple suppliers and dedups by URL", async () => {
    const { gap } = await createGap();

    const s1 = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/submissions`,
      payload: {
        url: "https://news.example.com/acme-vietnam-launch",
        title: "Acme launches WidgetNet in Vietnam",
        publisher: "Example News",
        publishedAt: new Date().toISOString(),
        excerpt: "Acme Corp confirmed it deployed WidgetNet across Vietnam.",
        supplierAddress: SUPPLIER_A,
      },
    });
    expect(s1.statusCode).toBe(201);
    expect(s1.json().duplicate).toBe(false);

    const s2 = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/submissions`,
      payload: {
        url: "https://blog.acme.example.com/widgetnet-vn",
        title: "WidgetNet Vietnam deployment notes",
        publishedAt: new Date().toISOString(),
        excerpt: "Engineering notes on the Vietnam rollout.",
        supplierAddress: SUPPLIER_B,
      },
    });
    expect(s2.statusCode).toBe(201);

    // duplicate canonical URL -> 200 + duplicate flag, not a new row
    const dup = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/submissions`,
      payload: {
        url: "https://news.example.com/acme-vietnam-launch?utm_source=x",
        supplierAddress: SUPPLIER_B,
      },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json().duplicate).toBe(true);

    const detail = await app.inject({ method: "GET", url: `/api/gaps/${gap.id}` });
    expect(detail.json().submissions).toHaveLength(2);
  });

  it("evaluates, settles, issues a receipt, and supports consume", async () => {
    const { gap } = await createGap();
    for (const [url, supplier] of [
      ["https://a.example.com/one", SUPPLIER_A],
      ["https://b.example.com/two", SUPPLIER_B],
    ] as const) {
      await app.inject({
        method: "POST",
        url: `/api/gaps/${gap.id}/submissions`,
        payload: {
          url,
          title: "evidence",
          publishedAt: new Date().toISOString(),
          excerpt: `Direct statement supporting the claim ${url}`,
          supplierAddress: supplier,
        },
      });
    }

    const ev = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/evaluate`,
    });
    expect(ev.statusCode).toBe(200);
    expect(ev.json().evaluations).toHaveLength(2);

    const fin = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/finalize`,
    });
    expect(fin.statusCode).toBe(200);
    const { plan, receipt, settlementTx } = fin.json();
    expect(settlementTx).toBeNull(); // no contract configured -> offchain only
    const paid = plan.payouts.reduce(
      (s: bigint, p: { amountUnits: string }) => s + BigInt(p.amountUnits),
      0n,
    );
    expect(paid + BigInt(plan.refundUnits)).toBe(50000n);
    expect(receipt.receiptHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(receipt.bountyId).toBe(gap.id);

    const r1 = await app.inject({
      method: "GET",
      url: `/api/receipts/${receipt.id}`,
    });
    expect(r1.statusCode).toBe(200);
    const r2 = await app.inject({
      method: "GET",
      url: `/api/gaps/${gap.id}/receipt`,
    });
    expect(r2.json().receiptHash).toBe(receipt.receiptHash);

    const consume = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/consume`,
    });
    expect(consume.json().gap.status).toBe("consumed");

    // double finalize rejected
    const fin2 = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/finalize`,
    });
    expect(fin2.statusCode).toBe(409);
  });

  it("rejects submissions after the deadline", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const res = await app.inject({
      method: "POST",
      url: "/api/gaps",
      payload: {
        question: "q",
        claim: "c",
        requirements: {},
        budgetUnits: "1000",
        requester: { address: REQUESTER },
        deadline: new Date(Date.now() + 1000).toISOString(),
      },
    });
    const { gap } = res.json();
    expect(res.statusCode).toBe(201);
    vi.setSystemTime(Date.now() + 2000);
    const sub = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/submissions`,
      payload: { url: "https://x.example.com/late", supplierAddress: SUPPLIER_A },
    });
    expect(sub.statusCode).toBe(409);
    expect(sub.json().error).toContain("deadline");
  });

  it("expires a past-deadline gap on read and allows cancel", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const res = await app.inject({
      method: "POST",
      url: "/api/gaps",
      payload: {
        question: "q",
        claim: "c",
        requirements: {},
        budgetUnits: "1000",
        requester: { address: REQUESTER },
        deadline: new Date(Date.now() + 1000).toISOString(),
      },
    });
    const { gap } = res.json();
    expect(res.statusCode).toBe(201);
    vi.setSystemTime(Date.now() + 2000);
    const view = await app.inject({ method: "GET", url: `/api/gaps/${gap.id}` });
    expect(view.json().gap.status).toBe("expired");

    const fin = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/finalize`,
    });
    expect(fin.statusCode).toBe(409);

    const cancel = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/cancel`,
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().gap.status).toBe("cancelled");
    expect(cancel.json().cancelTx).toBeNull(); // offchain: no bounty onchain

    const again = await app.inject({
      method: "POST",
      url: `/api/gaps/${gap.id}/cancel`,
    });
    expect(again.statusCode).toBe(409);
  });
});
