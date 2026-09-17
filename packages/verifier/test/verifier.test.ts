import { describe, expect, it } from "vitest";
import {
  MockSemanticProvider,
  evaluateSubmission,
  runDeterministicChecks,
} from "../src/index.js";
import {
  evidenceRequirementSchema,
  type EvidenceSubmission,
  type GapRequest,
} from "@gap402/schemas";

const gap = {
  protocol: "gap402",
  version: "1",
  id: "gap_t",
  question: "q",
  claim: "Acme deployed WidgetNet in Vietnam",
  requirements: evidenceRequirementSchema.parse({
    claim: "Acme deployed WidgetNet in Vietnam",
    maxSourceAgeSeconds: 30 * 86400,
    minSupportScore: 100_000,
    domainBlocklist: ["blocked.example"],
  }),
  budgetUnits: "1000",
  currency: "USDC",
  requester: { id: "r", kind: "service" },
  requesterAddress: "0x1000000000000000000000000000000000000001",
  verifierAddress: "0x2000000000000000000000000000000000000002",
  createdAt: "2026-09-17T00:00:00Z",
  deadline: "2026-09-18T00:00:00Z",
  status: "open",
} as unknown as GapRequest;

const sub = (over: Partial<EvidenceSubmission> = {}) =>
  ({
    protocol: "gap402",
    version: "1",
    id: "sub_1",
    bountyId: "gap_t",
    supplier: { id: "s", kind: "service" },
    supplierAddress: "0x3000000000000000000000000000000000000003",
    canonicalUrl: "https://news.example.com/a",
    retrievedAt: "2026-09-17T12:00:00Z",
    publishedAt: "2026-09-10T00:00:00Z",
    contentHash: `0x${"ab".repeat(32)}`,
    excerpt: "Acme confirmed WidgetNet deployment in Vietnam.",
    claimRelation: "supports",
    sourceType: "independent",
    submittedAt: "2026-09-17T12:00:00Z",
    ...over,
  }) as EvidenceSubmission;

describe("deterministic checks", () => {
  it("flags duplicates against existing submissions", async () => {
    const existing = [sub({ id: "sub_0" })];
    const dup = sub({ id: "sub_1" });
    const checks = runDeterministicChecks(dup, {
      gap,
      existing,
      now: new Date("2026-09-17T12:05:00Z"),
    });
    expect(checks.some((c) => !c.passed)).toBe(true);
  });

  it("rejects stale sources", async () => {
    const ev = await evaluateSubmission(sub({ publishedAt: "2020-01-01T00:00:00Z" }), {
      gap,
      existing: [],
      now: new Date("2026-09-17T12:05:00Z"),
    });
    expect(ev.verdict).toBe("rejected");
    expect(ev.rejectReasons.join(" ")).toMatch(/fresh|age|stale/i);
  });

  it("rejects blocklisted domains", async () => {
    const ev = await evaluateSubmission(
      sub({ canonicalUrl: "https://blocked.example/x" }),
      { gap, existing: [], now: new Date("2026-09-17T12:05:00Z") },
    );
    expect(ev.verdict).toBe("rejected");
  });

  it("accepts qualifying evidence via mock semantic provider", async () => {
    const ev = await evaluateSubmission(sub(), {
      gap,
      existing: [],
      now: new Date("2026-09-17T12:05:00Z"),
      semantic: new MockSemanticProvider(),
    });
    expect(ev.verdict).toBe("accepted");
    expect(ev.scores.support).toBeGreaterThanOrEqual(100_000);
    expect(ev.evaluatorVersion).toContain("mock");
  });

  it("rejects when semantic support is below the floor", async () => {
    const ev = await evaluateSubmission(
      sub({ excerpt: "Completely unrelated content about deep-sea fishing." }),
      {
        gap,
        existing: [],
        now: new Date("2026-09-17T12:05:00Z"),
        semantic: new MockSemanticProvider(),
      },
    );
    expect(ev.verdict).toBe("rejected");
  });
});
