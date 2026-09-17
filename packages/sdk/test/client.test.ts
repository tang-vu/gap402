import { describe, expect, it } from "vitest";
import { Gap402, Gap402Error } from "../src/client.js";

function stubFetch(
  handler: (url: string, init: RequestInit) => { status: number; body: unknown },
) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const { status, body } = handler(String(url), init ?? { method: "GET" });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const GAP_VIEW = {
  gap: { id: "g1", status: "open" },
  runtime: {},
  submissionCount: 0,
};

describe("Gap402 client", () => {
  it("createGap converts human budget to base units", async () => {
    let sent: Record<string, unknown> = {};
    const gap = new Gap402({
      api: "http://x",
      fetchImpl: stubFetch((_url, init) => {
        sent = JSON.parse(String(init.body));
        return { status: 200, body: GAP_VIEW };
      }),
    });
    await gap.createGap({
      question: "q",
      claim: "c",
      budget: "0.05",
      deadlineSeconds: 3600,
    });
    expect(sent.budgetUnits).toBe("50000");
    expect(sent.question).toBe("q");
  });

  it("throws Gap402Error with status on non-ok responses", async () => {
    const gap = new Gap402({
      api: "http://x",
      fetchImpl: stubFetch(() => ({ status: 409, body: { error: "already settled" } })),
    });
    await expect(gap.getGap("g1")).rejects.toThrow(Gap402Error);
    await expect(gap.getGap("g1")).rejects.toThrow(/409/);
  });

  it("getReceiptByBounty maps 404 to null", async () => {
    const gap = new Gap402({
      api: "http://x",
      fetchImpl: stubFetch(() => ({ status: 404, body: { error: "not found" } })),
    });
    expect(await gap.getReceiptByBounty("g1")).toBeNull();
  });

  it("waitForEvidence returns on terminal status", async () => {
    let calls = 0;
    const gap = new Gap402({
      api: "http://x",
      fetchImpl: stubFetch(() => {
        calls += 1;
        return {
          status: 200,
          body: {
            gap: { id: "g1", status: calls < 2 ? "open" : "settled" },
            runtime: {},
            submissionCount: 2,
          },
        };
      }),
    });
    const view = await gap.waitForEvidence("g1", { intervalMs: 1, timeoutMs: 5000 });
    expect(view.gap.status).toBe("settled");
    expect(calls).toBe(2);
  });

  it("waitForEvidence times out on non-terminal status", async () => {
    const gap = new Gap402({
      api: "http://x",
      fetchImpl: stubFetch(() => ({ status: 200, body: GAP_VIEW })),
    });
    await expect(
      gap.waitForEvidence("g1", { intervalMs: 1, timeoutMs: 30 }),
    ).rejects.toThrow(/timed out/);
  });
});
