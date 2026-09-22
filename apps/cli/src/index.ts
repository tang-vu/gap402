#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { Gap402, Gap402Chain } from "@gap402/sdk";
import { computeReceiptHash, verifyBundle } from "@gap402/protocol";
import { evidenceReceiptSchema, type EvidenceReceipt } from "@gap402/schemas";
import { formatUsdcAmount, resolveNetwork, ConfigError } from "@gap402/config";

const API = () => process.env.GAP402_API ?? "http://127.0.0.1:4020";
const client = () =>
  new Gap402({ api: API(), writeToken: process.env.GAP402_WRITE_TOKEN });

const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));
const fail = (msg: string): never => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

const program = new Command();
program
  .command("proof-export")
  .argument("<gapId>")
  .action(async (id) => out(await client().getProof(id)));
program
  .command("proof-verify")
  .argument("<file>")
  .action((file) => {
    const result = verifyBundle(JSON.parse(readFileSync(file, "utf8")));
    out(result);
    if (!result.valid) process.exitCode = 1;
  });
program
  .name("gap402")
  .description("gap402 — turn uncertainty into a market")
  .version("0.1.0");

const gap = program.command("gap").description("manage evidence gaps");

gap
  .command("create")
  .description("create an evidence gap (funds the bounty when configured)")
  .requiredOption("--question <q>", "research question")
  .requiredOption("--claim <c>", "exact claim to verify")
  .requiredOption("--budget <usdc>", "bounty budget in USDC, e.g. 0.05")
  .option("--context <ctx>", "additional context")
  .option("--deadline-seconds <n>", "seconds until deadline", "3600")
  .option("--requirements <json>", "requirement overrides JSON")
  .option("--requester-address <addr>", "requester wallet address")
  .action(async (o) => {
    const requirements = o.requirements ? JSON.parse(o.requirements) : {};
    const c = new Gap402({
      api: API(),
      ...(o.requesterAddress
        ? {
            requester: {
              id: "gap402-cli",
              kind: "eoa" as const,
              address: o.requesterAddress as `0x${string}`,
            },
          }
        : {}),
    });
    const res = await c.createGap({
      question: o.question,
      claim: o.claim,
      context: o.context,
      budget: o.budget,
      deadlineSeconds: Number(o.deadlineSeconds),
      requirements,
    });
    out(res);
  });

gap
  .command("list")
  .description("list gaps")
  .option("--status <s>", "filter by status")
  .action(async (o) => {
    const res = await client().listGaps({ status: o.status });
    for (const g of res.gaps) {
      console.log(
        `${g.gap.id}  ${g.gap.status.padEnd(11)} ${formatUsdcAmount(BigInt(g.gap.budgetUnits))} USDC  subs=${g.submissionCount}  ${g.gap.claim.slice(0, 72)}`,
      );
    }
  });

gap
  .command("inspect")
  .description("show gap detail, submissions, evaluations, plan")
  .argument("<id>")
  .action(async (id) => {
    const res = await fetch(`${API()}/api/gaps/${id}`);
    if (!res.ok) fail(`gap ${id}: ${res.status}`);
    out(await res.json());
  });

const evidence = program.command("evidence").description("submit and evaluate evidence");

evidence
  .command("submit")
  .description("submit evidence to a gap")
  .argument("<gapId>")
  .requiredOption("--url <url>", "evidence URL")
  .requiredOption("--supplier-address <addr>", "supplier payout address")
  .option("--title <t>")
  .option("--publisher <p>")
  .option("--published-at <iso>")
  .option("--excerpt <e>")
  .option("--claim-relation <r>")
  .option("--source-type <s>")
  .option("--commit", "also commit the evidence hash onchain")
  .option("--supplier-key <key>", "supplier private key (required for --commit)")
  .action(async (gapId, o) => {
    const res = await client().submitEvidence(gapId, {
      url: o.url,
      supplierAddress: o.supplierAddress as `0x${string}`,
      title: o.title,
      publisher: o.publisher,
      publishedAt: o.publishedAt,
      excerpt: o.excerpt,
      claimRelation: o.claimRelation,
      sourceType: o.sourceType,
      commitOnchain: o.commit ?? false,
      ...(o.supplierKey ? { supplierKey: o.supplierKey } : {}),
    });
    out(res);
  });

evidence
  .command("evaluate")
  .description("run verifier over a gap's submissions")
  .argument("<gapId>")
  .action(async (gapId) => out(await client().evaluateGap(gapId)));

const bounty = program.command("bounty").description("bounty lifecycle");

bounty
  .command("finalize")
  .description("settle a gap: evaluate, allocate, pay out, anchor receipt")
  .argument("<gapId>")
  .action(async (gapId) => out(await client().finalizeGap(gapId)));

bounty
  .command("cancel")
  .description("cancel an expired gap; reclaims escrow when funded onchain")
  .argument("<gapId>")
  .action(async (gapId) => out(await client().cancelGap(gapId)));

const receipt = program.command("receipt").description("evidence receipts");

receipt
  .command("get")
  .description("fetch a receipt by id")
  .argument("<id>")
  .action(async (id) => out(await client().getReceipt(id)));

receipt
  .command("verify")
  .description(
    "independently verify a receipt: canonical hash, schema, optional onchain anchor",
  )
  .argument("<idOrFile>", "receipt id, or path to a receipt JSON file")
  .option("--registry <addr>", "receipt registry address for onchain check")
  .action(async (idOrFile, o) => {
    let doc: EvidenceReceipt;
    if (idOrFile.endsWith(".json") || idOrFile.includes("/") || idOrFile.includes("\\")) {
      doc = evidenceReceiptSchema.parse(JSON.parse(readFileSync(idOrFile, "utf8")));
    } else {
      doc = evidenceReceiptSchema.parse(await client().getReceipt(idOrFile));
    }
    const recomputed = computeReceiptHash(doc);
    const checks: Record<string, unknown> = {
      receiptId: doc.id,
      bountyId: doc.bountyId,
      storedHash: doc.receiptHash,
      recomputedHash: recomputed,
      hashMatch: recomputed === doc.receiptHash,
      acceptedEvidence: doc.acceptedEvidence.length,
      totalPaidUnits: doc.totalPaidUnits,
    };
    // Exact accounting: evidence payouts + verifier fee == totalPaid.
    const evidenceSum = doc.acceptedEvidence.reduce(
      (s, e) => s + BigInt(e.payoutUnits),
      0n,
    );
    checks.evidencePaidUnits = evidenceSum.toString();
    checks.accountingExact =
      evidenceSum + BigInt(doc.verifierFeeUnits) === BigInt(doc.totalPaidUnits);
    if (o.registry) {
      const network = resolveNetwork();
      const chain = new Gap402Chain(network);
      checks.onchainAnchored = await chain.isReceiptAnchored(o.registry, doc.receiptHash);
    }
    out(checks);
    if (
      !checks.hashMatch ||
      checks.accountingExact === false ||
      checks.onchainAnchored === false
    ) {
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("check environment, network config, RPC and API reachability")
  .action(async () => {
    const report: Record<string, unknown> = {};
    try {
      const network = resolveNetwork();
      report.network = network.name;
      report.chainId = network.chainId;
      report.rpcUrl = network.rpcUrl;
      report.explorer = network.explorerUrl;
      report.usdc = network.usdcAddress;
      try {
        const chain = new Gap402Chain(network);
        const id = await chain.public.getChainId();
        report.rpcReachable = true;
        report.rpcChainId = id;
        report.chainIdMatch = id === network.chainId;
      } catch (e) {
        report.rpcReachable = false;
        report.rpcError = e instanceof Error ? e.message : String(e);
      }
    } catch (e) {
      report.configError = e instanceof ConfigError ? e.message : String(e);
    }
    try {
      const h = await client().health();
      report.api = h;
    } catch {
      report.api = { ok: false, url: API() };
    }
    report.keysConfigured = {
      PRIVATE_KEY: Boolean(process.env.PRIVATE_KEY),
      VERIFIER_PRIVATE_KEY: Boolean(process.env.VERIFIER_PRIVATE_KEY),
      GAP_BOUNTY_ADDRESS: Boolean(process.env.GAP_BOUNTY_ADDRESS),
      MAINNET_ENABLED: process.env.MAINNET_ENABLED === "true",
    };
    out(report);
    if (report.configError || report.chainIdMatch === false) process.exit(1);
  });

program.parseAsync().catch((e) => fail(e instanceof Error ? e.message : String(e)));
