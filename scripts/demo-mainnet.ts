/**
 * gap402 MAINNET demo — controlled live run on Arc mainnet (real USDC).
 *
 * Required env:
 *   MAINNET_ENABLED=true
 *   GAP402_NETWORK=mainnet
 *   PRIVATE_KEY=0x…            requester (never logged)
 *   VERIFIER_PRIVATE_KEY=0x…   verifier
 *   GAP_BOUNTY_ADDRESS=0x…     deployed contract (run `pnpm deploy` first)
 *   DEMO_CONFIRM=YES           explicit consent to spend real USDC
 *   DEMO_MAX_USDC=0.10         hard spend cap (default 0.10)
 *
 *   pnpm demo:mainnet
 *
 * Fails closed: any missing config, chain-id mismatch, insufficient balance,
 * or missing DEMO_CONFIRM aborts before any transaction is sent.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { Gap402, Gap402Chain } from "@gap402/sdk";
import {
  resolveNetwork,
  formatUsdcAmount,
  parseUsdcAmount,
  explorerTxUrl,
  ConfigError,
} from "@gap402/config";
import { privateKeyToAccount } from "viem/accounts";
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

const API_PORT = 4138;
const line = (s = "") => console.log(s);
const step = (n: number, s: string) => line(`\n[${n}] ${s}`);

/** Real web source provider — fetches are plain GETs, evidence is real. */
class HttpSourceProvider implements SourceProvider {
  readonly name = "http-web";
  constructor(private urls: string[]) {}
  async search(_q: string, limit: number): Promise<CandidateSource[]> {
    const out: CandidateSource[] = [];
    for (const url of this.urls.slice(0, limit)) {
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "gap402-evidence-bot/0.1" },
          signal: AbortSignal.timeout(10_000),
        });
        const text = await res.text();
        out.push({
          url,
          title: /<title[^>]*>([^<]{1,200})/i.exec(text)?.[1]?.trim(),
          excerpt: text
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 1500),
          claimRelation: "unknown" as const,
          sourceType: "independent",
        });
      } catch (e) {
        line(`  [provider] fetch failed ${url}: ${(e as Error).message}`);
      }
    }
    return out;
  }
}

async function main() {
  step(0, "pre-flight (fail closed)");
  if (process.env.MAINNET_ENABLED !== "true")
    throw new ConfigError("MAINNET_ENABLED=true required");
  if ((process.env.GAP402_NETWORK ?? "mainnet") !== "mainnet")
    throw new ConfigError("GAP402_NETWORK must be mainnet for this script");
  if (process.env.DEMO_CONFIRM !== "YES")
    throw new ConfigError("DEMO_CONFIRM=YES required — real USDC will be spent");
  if (!process.env.GAP402_WRITE_TOKEN)
    throw new ConfigError("GAP402_WRITE_TOKEN required for authenticated mainnet writes");
  const requesterKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  const contract = process.env.GAP_BOUNTY_ADDRESS as `0x${string}` | undefined;
  if (!requesterKey || !verifierKey || !contract)
    throw new ConfigError(
      "PRIVATE_KEY, VERIFIER_PRIVATE_KEY and GAP_BOUNTY_ADDRESS are all required",
    );

  const network = resolveNetwork("mainnet");
  const chain = new Gap402Chain(network);
  await chain.verifyNetwork(); // hard chain-id check vs RPC
  line(`  network verified: ${network.name} chainId ${network.chainId}`);

  const requester = privateKeyToAccount(requesterKey).address;
  const maxSpend = parseUsdcAmount(process.env.DEMO_MAX_USDC ?? "0.10");
  const bountyAmount = parseUsdcAmount(process.env.DEMO_BOUNTY_USDC ?? "0.05");
  if (bountyAmount > maxSpend) throw new ConfigError("bounty exceeds DEMO_MAX_USDC");

  const balance = await chain.usdcBalanceOf(requester);
  line(`  requester:   ${requester}`);
  line(`  balance:     ${formatUsdcAmount(balance)} USDC`);
  line(`  spend cap:   ${formatUsdcAmount(maxSpend)} USDC`);
  line(`  bounty:      ${formatUsdcAmount(bountyAmount)} USDC`);
  line(`  contract:    ${contract}`);
  if (balance < bountyAmount)
    throw new ConfigError(`insufficient USDC: need ${formatUsdcAmount(bountyAmount)}`);

  step(1, "API + agents");
  const app = await buildServer({
    store: new Store(process.env.DATABASE_URL ?? "sqlite:./data/gap402-mainnet-demo.db"),
    network,
    requesterKey,
    verifierKey,
    bountyContract: contract,
  });
  await app.listen({ port: API_PORT, host: "127.0.0.1" });
  const api = `http://127.0.0.1:${API_PORT}`;

  // Real sources must be provided: DEMO_SOURCE_URLS is a comma-separated
  // list of publicly accessible pages relevant to DEMO_CLAIM.
  const question = process.env.DEMO_QUESTION ?? "Is the Arc mainnet USDC contract live?";
  const claim =
    process.env.DEMO_CLAIM ??
    "Arc mainnet exposes USDC at 0x3600000000000000000000000000000000000000";
  const sourceUrls = (process.env.DEMO_SOURCE_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sourceUrls.length === 0)
    throw new ConfigError(
      "DEMO_SOURCE_URLS required — mainnet demo uses REAL web sources, no fixtures",
    );

  step(2, `question: "${question}"`);
  const buyer = new AutonomousBuyer(
    new Gap402({
      api,
      writeToken: process.env.GAP402_WRITE_TOKEN,
      requester: { id: "mainnet-demo", kind: "service", address: requester },
    }),
    {
      maxTotalUnits: maxSpend,
      maxBountyUnits: bountyAmount,
      autoPayBelowUnits: bountyAmount,
      minDeadlineSeconds: 600,
      waitTimeoutMs: Number(process.env.DEMO_WAIT_MS ?? 15 * 60 * 1000),
    },
    heuristicCoverage,
  );
  const buyerPromise = buyer.ensureEvidence({
    question,
    claim,
    context: "arc mainnet controlled demo",
    evidence: [], // deliberately empty: force the gap
    budgetUnits: bountyAmount,
    deadlineSeconds: 3600,
  });
  await sleep(800);
  const { gaps } = await new Gap402({ api }).listGaps();
  const gapId = gaps[gaps.length - 1]!.gap.id;
  line(`  bounty open: ${gapId}`);
  const rt: any = await fetch(`${api}/api/gaps/${gapId}`).then((r) => r.json());
  line(
    `  fund tx: ${rt.runtime.fundTxHash} ${explorerTxUrl(network.explorerUrl, rt.runtime.fundTxHash ?? "") ?? ""}`,
  );

  step(3, "suppliers fetch REAL sources");
  const provider = new HttpSourceProvider(sourceUrls);
  const supplierKey = process.env.SUPPLIER_PRIVATE_KEY as `0x${string}` | undefined;
  const supplierAddr = supplierKey ? privateKeyToAccount(supplierKey).address : requester;
  const suppliers = [
    new IndependentSourceSupplier(client0(api), provider, supplierAddr),
    new OfficialSourceSupplier(client0(api), provider, supplierAddr),
    new SearchSupplier(client0(api), provider, supplierAddr),
  ];
  for (const s of suppliers) {
    const r = await s.runOnce();
    line(`  ${s.name}: submitted=${r.submitted} skipped=${r.skipped}`);
  }

  step(4, "evaluate + settle ON MAINNET");
  const fin: any = await fetch(`${api}/api/gaps/${gapId}/finalize`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.GAP402_WRITE_TOKEN}` },
  }).then((r) => r.json());
  line(`  settlement tx: ${fin.settlementTx}`);
  line(`  explorer: ${explorerTxUrl(network.explorerUrl, fin.settlementTx ?? "") ?? ""}`);
  for (const p of fin.plan.payouts) {
    line(
      `    ${formatUsdcAmount(BigInt(p.amountUnits))} USDC -> ${p.recipient} (${p.submissionId})`,
    );
  }
  line(`    ${formatUsdcAmount(BigInt(fin.plan.refundUnits))} USDC -> refund`);
  line(`  receipt:     ${fin.receipt.id}`);
  line(`  receiptHash: ${fin.receipt.receiptHash}`);

  const result = await buyerPromise;
  line(
    `  coverage: ${(result.coverageBeforeBps / 100).toFixed(0)}% -> ${((result.coverageAfterBps ?? 0) / 100).toFixed(0)}%`,
  );
  line("\n  The agent couldn't find the answer. So it created a market for one.\n");
  await app.close();
}

const client0 = (api: string) =>
  new Gap402({ api, writeToken: process.env.GAP402_WRITE_TOKEN });

main().catch((e) => {
  console.error(e instanceof ConfigError ? `ABORTED: ${e.message}` : e);
  process.exit(1);
});
