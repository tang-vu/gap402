import { MockSemanticProvider } from "@gap402/verifier";
import { verifyBundle } from "@gap402/protocol";
import { GapService } from "./service.js";
import { Store } from "./store.js";

/** Isolated product walkthrough: real domain engine, fixture sources, NO chain client. */
export async function runDemo(scenario: "mixed" | "rejected" | "insufficient") {
  const store = new Store("sqlite::memory:");
  const verifier = "0x1000000000000000000000000000000000000001";
  const service = new GapService(store, verifier, new MockSemanticProvider());
  try {
    const { gap } = service.createGap({
      question: "Can the research agent substantiate Acme's Vietnam launch?",
      claim: "Acme deployed WidgetNet in Vietnam",
      budgetUnits: "50000",
      requesterAddress: "0x2000000000000000000000000000000000000002",
      requirements: {
        maxSourceAgeSeconds: 30 * 86400,
        minSupportScore: 600000,
        minIndependentSources: scenario === "insufficient" ? 3 : 0,
      },
    });
    service.setStatus(gap.id, "open");
    const fixtures = [
      {
        url: "https://acme.example.com/launch",
        sourceType: "official" as const,
        title: gap.claim,
        excerpt: `${gap.claim}. Primary announcement (simulated).`,
        age: 1,
        supplierAddress: "0x3000000000000000000000000000000000000003" as const,
      },
      {
        url: "https://reporter.example.net/report",
        sourceType: "independent" as const,
        title: gap.claim,
        excerpt: `${gap.claim}. Independent site visit (simulated).`,
        age: 2,
        supplierAddress: "0x4000000000000000000000000000000000000004" as const,
      },
      {
        url: "https://archive.example.org/rumor",
        sourceType: "aggregated" as const,
        title: "Old rumor",
        excerpt: "An unrelated product was discussed last year (simulated).",
        age: 400,
        supplierAddress: "0x5000000000000000000000000000000000000005" as const,
      },
    ];
    for (const f of scenario === "rejected" ? fixtures.slice(2) : fixtures) {
      service.submitEvidence(gap.id, {
        ...f,
        publishedAt: new Date(Date.now() - f.age * 86400000).toISOString(),
        claimRelation: "unknown",
      });
    }
    const first = fixtures[0]!;
    const duplicate =
      scenario === "rejected"
        ? false
        : service.submitEvidence(gap.id, {
            ...first,
            url: `${first.url}?utm_source=repost`,
          }).duplicate;
    const evaluations = await service.evaluateGap(gap.id);
    const common = {
      mode: "simulation" as const,
      sourceMode: "synthetic fixtures" as const,
      verifierMode: "mock-v1" as const,
      actualSpendUnits: "0",
      duplicatePrevented: duplicate,
      submissions: service.listSubmissions(gap.id),
      evaluations,
      before: "No admissible evidence; agent must abstain.",
    };
    if (scenario === "insufficient") {
      try {
        service.buildPlan(gap.id);
      } catch (e) {
        return {
          ...common,
          gap: service.getGap(gap.id)!,
          plan: null,
          receipt: null,
          integrity: null,
          after: "Agent remains blocked: independent-source requirement unmet.",
          blockedReason: (e as Error).message,
        };
      }
      throw new Error("independent-source guard did not block");
    }
    const plan = service.buildPlan(gap.id);
    service.savePlan(plan);
    const receipt = service.buildReceipt(gap.id, plan, {
      network: "local",
      chainId: 31337,
      bountyContract: "0x0000000000000000000000000000000000000000",
    });
    service.saveReceipt(receipt);
    service.setStatus(gap.id, "settled");
    const bundle = { gap: service.getGap(gap.id)!, plan, receipt };
    const integrity = verifyBundle(bundle);
    if (!integrity.valid) throw new Error("demo proof integrity failed");
    if (receipt.acceptedEvidence.length)
      bundle.gap = service.setStatus(gap.id, "consumed");
    return {
      ...common,
      ...bundle,
      integrity,
      after: receipt.acceptedEvidence.length
        ? "Agent can cite the accepted fixture portfolio; no real-world claim has been established."
        : "Agent abstains. No supplier receives a payout; verifier fee and refund remain explicit.",
      blockedReason: null,
    };
  } finally {
    store.close();
  }
}
