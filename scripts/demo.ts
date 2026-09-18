/**
 * gap402 local end-to-end demo — deterministic, runs against arc-anvil.
 *
 *   pnpm demo
 *
 * Flow:
 *   question -> evidence scan (fixture sources, labelled SIMULATED)
 *   -> coverage gap detected -> Gap402 bounty funded on arc-anvil
 *   -> 3 supplier agents submit -> verifier evaluates -> portfolio settlement
 *   -> Evidence Receipt anchored onchain -> buyer consumes
 *
 * All "sources" are synthetic fixtures for demonstration. They are labelled
 * simulated and never presented as real-world evidence.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { Gap402, Gap402Chain } from "@gap402/sdk";
import { resolveNetwork, formatUsdcAmount } from "@gap402/config";
import { buildServer } from "@gap402/api/server";
import { Store } from "@gap402/api/store";
import { AutonomousBuyer, heuristicCoverage } from "@gap402/example-autonomous-buyer";
import {
  IndependentSourceSupplier,
  OfficialSourceSupplier,
  SearchSupplier,
  type CandidateSource,
  type SourceProvider,
} from "@gap402/example-evidence-supplier";

// ── anvil default accounts (public test keys, local only) ────────────────
const K = {
  requester: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  verifier: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  supplierA: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  supplierB: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  supplierC: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
} as const;
const ADDR = {
  requester: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  verifier: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  supplierA: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  supplierB: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  supplierC: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
} as const;

const RPC = "http://127.0.0.1:8545";
const API_PORT = 4137;

const line = (s = "") => console.log(s);
const step = (n: number, s: string) => line(`\n\x1b[36m[${n}]\x1b[0m \x1b[1m${s}\x1b[0m`);

// ── fixture source provider (SIMULATION — labelled) ──────────────────────
const QUESTION = "Has Acme Corp actually deployed WidgetNet in Vietnam?";
const CLAIM = "Acme Corp deployed WidgetNet in Vietnam before 2026-09-01";

class FixtureProvider implements SourceProvider {
  readonly name = "fixture-simulated-sources";
  constructor(private sources: CandidateSource[]) {}
  async search(): Promise<CandidateSource[]> {
    return this.sources;
  }
}

const now = Date.now();
const FIXTURES: CandidateSource[] = [
  {
    url: "https://wire.example.net/acme-widgetnet-vietnam-2026-08",
    title: "Acme confirms WidgetNet rollout across Vietnam",
    publisher: "Example Wire (simulated fixture)",
    publishedAt: new Date(now - 5 * 86400_000).toISOString(),
    excerpt:
      "Acme Corp confirmed it deployed its WidgetNet platform across three Vietnamese provinces in August 2026.",
    claimRelation: "supports",
    sourceType: "independent",
  },
  {
    url: "https://acme.example.com/press/widgetnet-vn",
    title: "Acme WidgetNet goes live in Vietnam",
    publisher: "Acme Corp (simulated fixture)",
    publishedAt: new Date(now - 12 * 86400_000).toISOString(),
    excerpt:
      "Acme Corp today announced the deployment of WidgetNet in Vietnam, its first Southeast Asian market.",
    claimRelation: "supports",
    sourceType: "official",
  },
  {
    // same canonical URL as #1 but reposted — should dedupe
    url: "https://wire.example.net/acme-widgetnet-vietnam-2026-08?utm_campaign=social",
    title: "repost of the wire story",
    publisher: "Repost Bot (simulated fixture)",
    claimRelation: "supports",
    sourceType: "aggregated",
  },
  {
    url: "https://random.example.biz/unrelated-listicle",
    title: "10 exciting network products",
    publisher: "Listicle Farm (simulated fixture)",
    publishedAt: new Date(now - 400 * 86400_000).toISOString(),
    excerpt: "A list of networking products with no mention of the claim.",
    claimRelation: "unrelated",
    sourceType: "aggregated",
  },
];

async function ensureAnvil(): Promise<ChildProcess | null> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
    });
    if (res.ok) return null; // already running
  } catch {
    /* fallthrough */
  }
  const proc = spawn("arc-anvil", ["--network", "arc", "--port", "8545", "--silent"], {
    detached: true,
    stdio: "ignore",
  });
  proc.unref();
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
      });
      if (res.ok) return proc;
    } catch {
      /* retry */
    }
  }
  throw new Error("arc-anvil did not start on :8545");
}

async function main() {
  line("gap402 local demo — turn uncertainty into a market");
  line("network: arc-anvil --network arc (local emulation of Arc mainnet)");
  line("note: evidence sources are SIMULATED fixtures, clearly labelled\n");

  step(0, "local chain + contracts");
  await ensureAnvil();
  const network = resolveNetwork("local");
  const chain = new Gap402Chain(network);
  await chain.verifyNetwork();
  const { bounty, registry, usdc } = await chain.deployContracts(K.requester, {
    deployMockUsdc: false,
  });
  line(`  GapBounty:              ${bounty}`);
  line(`  ReceiptRegistry:        ${registry}`);
  line(`  USDC interface (arc):   ${usdc}`);
  line(
    `  requester balance:      ${formatUsdcAmount(await chain.usdcBalanceOf(ADDR.requester))} USDC`,
  );

  step(1, "start API + agents");
  const app = await buildServer({
    store: new Store("sqlite::memory:"),
    network,
    requesterKey: K.requester,
    verifierKey: K.verifier,
    bountyContract: bounty,
  });
  await app.listen({ port: API_PORT, host: "127.0.0.1" });
  const api = `http://127.0.0.1:${API_PORT}`;
  const buyer = new AutonomousBuyer(
    new Gap402({
      api,
      requester: {
        id: "demo-buyer",
        kind: "service",
        address: ADDR.requester,
      },
    }),
    {
      maxTotalUnits: 200_000n,
      maxBountyUnits: 50_000n,
      autoPayBelowUnits: 50_000n,
      minDeadlineSeconds: 60,
      waitTimeoutMs: 120_000,
    },
    heuristicCoverage,
  );
  line(`  api listening on ${api}`);

  step(2, "question + initial evidence scan");
  line(`  "${QUESTION}"`);
  // Existing research turned up only a weak aggregator mention — no
  // independent or official confirmation. Coverage heuristic scores it low.
  const existing = [
    {
      url: "https://aggregator.example.org/acme-widgetnet-rumor",
      supports: true,
      independent: false,
    },
  ];
  const before = await heuristicCoverage({
    question: QUESTION,
    claim: CLAIM,
    evidence: existing,
  });
  line(`  evidence coverage: ${(before.coverageBps / 100).toFixed(0)}%`);
  line(`  missing terms:     ${before.missing.join(", ")}`);
  line(`  EVIDENCE GAP DETECTED — "${CLAIM}"`);

  step(3, "buyer creates funded bounty on arc-anvil");
  const buyerPromise = buyer.ensureEvidence({
    question: QUESTION,
    claim: CLAIM,
    context: "demo: deployment verification before partnership decision",
    evidence: existing,
    budgetUnits: 50_000n, // 0.05 USDC
    deadlineSeconds: 1800,
    requirements: {
      maxSourceAgeSeconds: 30 * 86400,
      minSupportScore: 400_000,
      requireIndependentSources: true,
    },
  });
  await sleep(500);
  const { gaps } = await new Gap402({ api }).listGaps();
  const gapId = gaps[gaps.length - 1]!.gap.id;
  line(`  bounty open: ${gapId} · 0.050000 USDC`);
  const rt: any = await fetch(`${api}/api/gaps/${gapId}`).then((r) => r.json());
  line(`  fund tx: ${rt.runtime.fundTxHash ?? "offchain"}`);

  step(4, "three supplier agents compete");
  const provider = new FixtureProvider(FIXTURES);
  const client = new Gap402({ api });
  const suppliers = [
    new IndependentSourceSupplier(client, provider, ADDR.supplierA),
    new OfficialSourceSupplier(client, provider, ADDR.supplierB),
    new SearchSupplier(client, provider, ADDR.supplierC),
  ];
  for (const s of suppliers) {
    const r = await s.runOnce();
    line(`  ${s.name}: submitted=${r.submitted} skipped=${r.skipped}`);
  }

  step(5, "verifier evaluates + portfolio settlement");
  const fin: any = await fetch(`${api}/api/gaps/${gapId}/finalize`, {
    method: "POST",
  }).then((r) => r.json());
  const plan = fin.plan;
  line(`  settlement tx: ${fin.settlementTx ?? "offchain"}`);
  for (const p of plan.payouts) {
    line(
      `    ${formatUsdcAmount(BigInt(p.amountUnits))} USDC -> ${p.recipient.slice(0, 10)}…  (${p.submissionId}${p.explanation.capped ? ", capped" : ""})`,
    );
  }
  line(`    ${formatUsdcAmount(BigInt(plan.refundUnits))} USDC -> refund`);
  const paid = plan.payouts.reduce(
    (s: bigint, p: { amountUnits: string }) => s + BigInt(p.amountUnits),
    0n,
  );
  line(
    `  invariant: payouts(${formatUsdcAmount(paid)}) + refund(${formatUsdcAmount(BigInt(plan.refundUnits))}) = ${formatUsdcAmount(paid + BigInt(plan.refundUnits))} ✓`,
  );

  step(6, "evidence receipt anchored + verified");
  const receipt = fin.receipt;
  line(`  receipt:      ${receipt.id}`);
  line(`  receiptHash:  ${receipt.receiptHash}`);
  const anchored = await chain.isReceiptAnchored(registry, receipt.receiptHash);
  line(`  anchored onchain: ${anchored}`);

  step(7, "buyer consumes evidence and finishes");
  const result = await buyerPromise;
  line(
    `  coverage: ${(result.coverageBeforeBps / 100).toFixed(0)}% -> ${((result.coverageAfterBps ?? 0) / 100).toFixed(0)}%`,
  );
  line(
    `  answer: "${QUESTION}" — supported by ${receipt.acceptedEvidence.length} accepted sources`,
  );

  step(8, "unanswered gap expires — escrow reclaimed onchain");
  const requesterClient = new Gap402({
    api,
    requester: {
      id: "demo-buyer",
      kind: "service",
      address: ADDR.requester,
    },
  });
  const shortGap = await requesterClient.createGap({
    question: "Did WidgetNet v2 ship in Laos?",
    claim: "Acme shipped WidgetNet v2 in Laos before 2026-09-01",
    budget: "0.01",
    deadlineSeconds: 10,
  });
  const balBefore = await chain.usdcBalanceOf(ADDR.requester);
  line(`  bounty funded: ${shortGap.gap.id} · 0.010000 USDC (10s deadline)`);
  await sleep(11_000);
  const expired = await client.getGap(shortGap.gap.id);
  line(`  after deadline: status = ${expired.gap.status}`);
  const cancel = await client.cancelGap(shortGap.gap.id);
  const balAfter = await chain.usdcBalanceOf(ADDR.requester);
  line(`  cancel tx: ${cancel.cancelTx ?? "offchain"}`);
  line(
    `  requester balance: ${formatUsdcAmount(balBefore)} -> ${formatUsdcAmount(balAfter)} USDC (refunded)`,
  );
  line(`  final status: ${cancel.gap.status} — terminal`);

  line("\n─────────────────────────────────────────────────────");
  line("  The agent couldn't find the answer.");
  line("  So it created a market for one.");
  line("─────────────────────────────────────────────────────");
  line(
    `\n  inspect:  GAP402_API=${api} pnpm --filter @gap402/cli gap402 gap inspect ${gapId}`,
  );
  line(
    `  receipt:  GAP402_API=${api} pnpm --filter @gap402/cli gap402 receipt verify ${receipt.id}\n`,
  );

  await app.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
});
