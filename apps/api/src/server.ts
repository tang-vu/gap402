import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { privateKeyToAccount } from "viem/accounts";
import { resolveNetwork, type NetworkConfig, explorerTxUrl } from "@gap402/config";
import { Gap402Chain } from "@gap402/sdk";
import { computeSpecHash } from "@gap402/protocol";
import { bytes32Schema, evmAddressSchema } from "@gap402/schemas";
import type { SemanticProvider } from "@gap402/verifier";
import { DuplicateError, Store } from "./store.js";
import { GapService } from "./service.js";

export interface ApiDeps {
  store?: Store;
  network?: NetworkConfig;
  /** Server-side keys (demo/local). In production the requester signs. */
  requesterKey?: `0x${string}`;
  verifierKey?: `0x${string}`;
  bountyContract?: `0x${string}`;
  /** Semantic provider override; defaults to providerFromEnv(). */
  semantic?: SemanticProvider;
}

export async function buildServer(deps: ApiDeps = {}): Promise<FastifyInstance> {
  const network = deps.network ?? resolveNetwork();
  const store = deps.store ?? new Store(process.env.DATABASE_URL);
  const verifierKey =
    deps.verifierKey ??
    (process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined) ??
    (process.env.PRIVATE_KEY as `0x${string}` | undefined);
  const requesterKey =
    deps.requesterKey ?? (process.env.PRIVATE_KEY as `0x${string}` | undefined);
  const verifierAddress = verifierKey
    ? privateKeyToAccount(verifierKey).address
    : ("0x0000000000000000000000000000000000000001" as const);
  const bountyContract =
    deps.bountyContract ?? (process.env.GAP_BOUNTY_ADDRESS as `0x${string}` | undefined);

  const service = new GapService(store, verifierAddress, deps.semantic);
  const chain = new Gap402Chain(network);

  const app = Fastify({ logger: false });
  app.addContentTypeParser("*", (_req, _payload, done) => done(null));

  app.get("/api/health", async () => ({
    ok: true,
    protocol: "gap402",
    network: network.name,
    chainId: network.chainId,
    bountyContract: bountyContract ?? null,
    verifierAddress,
    explorer: network.explorerUrl,
  }));

  const createSchema = z.object({
    question: z.string().min(1).max(4096),
    claim: z.string().min(1).max(2048),
    context: z.string().max(8192).optional(),
    requirements: z.record(z.string(), z.unknown()).default({}),
    budgetUnits: z.string().regex(/^\d+$/),
    deadline: z.string().datetime({ offset: true }).optional(),
    deadlineSeconds: z
      .number()
      .int()
      .positive()
      .max(86400 * 30)
      .optional(),
    requester: z
      .object({
        id: z.string().optional(),
        kind: z.enum(["eoa", "service", "erc8004", "anonymous"]).optional(),
        address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      })
      .optional(),
  });

  app.post("/api/gaps", async (req, reply) => {
    const body = createSchema.parse(req.body ?? {});
    const requesterAddress = (body.requester?.address ??
      (requesterKey ? privateKeyToAccount(requesterKey).address : undefined)) as
      `0x${string}` | undefined;
    if (!requesterAddress) {
      return reply.code(400).send({ error: "requester.address or PRIVATE_KEY required" });
    }
    const { gap, runtime } = service.createGap({
      question: body.question,
      claim: body.claim,
      context: body.context,
      requirements: body.requirements,
      budgetUnits: body.budgetUnits,
      requesterAddress,
      requesterId: body.requester?.id,
      requesterKind: body.requester?.kind,
      deadline: body.deadline,
      deadlineSeconds: body.deadlineSeconds,
    });

    // Fund onchain when the contract + a requester key are configured.
    let fundTxHash: `0x${string}` | undefined;
    let chainBountyId: string | undefined;
    if (bountyContract && requesterKey) {
      const specHash = runtime.specHash ?? computeSpecHash(gap);
      const amount = BigInt(gap.budgetUnits);
      const deadlineUnix = BigInt(Math.floor(new Date(gap.deadline).getTime() / 1000));
      await chain.approveUsdc(requesterKey, bountyContract, amount);
      const { bountyId, txHash } = await chain.createBounty(
        bountyContract,
        requesterKey,
        {
          specHash,
          verifier: verifierAddress,
          amount,
          deadlineUnix,
          maxCommitments: 64,
        },
      );
      fundTxHash = txHash;
      chainBountyId = bountyId.toString();
      service.markRuntime(gap.id, {
        specHash,
        fundTxHash,
        chainBountyId,
        network: network.name,
      });
      service.setStatus(gap.id, "open");
    } else {
      service.markRuntime(gap.id, { network: network.name });
      service.setStatus(gap.id, "open");
    }
    const fresh = service.getGap(gap.id)!;
    return reply.code(201).send({
      gap: fresh,
      runtime: service.getRuntime(gap.id),
      submissionCount: 0,
      explorer: {
        fundTx: fundTxHash ? explorerTxUrl(network.explorerUrl, fundTxHash) : null,
      },
    });
  });

  app.get("/api/gaps", async (req) => {
    const { status } = req.query as { status?: string };
    let gaps = service.listGaps();
    if (status) gaps = gaps.filter((g) => g.status === status);
    return {
      gaps: gaps.map((g) => ({
        gap: g,
        runtime: service.getRuntime(g.id),
        submissionCount: service.listSubmissions(g.id).length,
      })),
    };
  });

  app.get("/api/gaps/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const gap = service.getGap(id);
    if (!gap) return reply.code(404).send({ error: "not found" });
    return {
      gap,
      runtime: service.getRuntime(id),
      submissions: service.listSubmissions(id),
      evaluations: service.listEvaluations(id),
      plan: service.getPlan(id),
      submissionCount: service.listSubmissions(id).length,
      explorer: {
        fundTx: service.getRuntime(id).fundTxHash
          ? explorerTxUrl(network.explorerUrl, service.getRuntime(id).fundTxHash!)
          : null,
        settlementTx: service.getRuntime(id).settlementTxHash
          ? explorerTxUrl(network.explorerUrl, service.getRuntime(id).settlementTxHash!)
          : null,
      },
    };
  });

  const submitSchema = z.object({
    url: z.string().url().max(2048),
    title: z.string().max(512).optional(),
    publisher: z.string().max(256).optional(),
    publishedAt: z.string().datetime({ offset: true }).optional(),
    excerpt: z.string().max(4000).optional(),
    content: z.string().max(200_000).optional(),
    contentHash: bytes32Schema.optional(),
    claimRelation: z
      .enum(["supports", "contradicts", "contextual", "unrelated", "unknown"])
      .optional(),
    sourceType: z
      .enum([
        "official",
        "primary",
        "independent",
        "aggregated",
        "social",
        "wiki",
        "unknown",
      ])
      .optional(),
    supplierAddress: evmAddressSchema,
    supplierId: z.string().max(256).optional(),
    costUnits: z.string().regex(/^\d+$/).optional(),
    commitOnchain: z.boolean().default(false),
    supplierKey: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  });

  app.post("/api/gaps/:id/submissions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = submitSchema.parse(req.body ?? {});
    try {
      const { submission, duplicate } = service.submitEvidence(id, body);
      // Optional onchain commitment (needs the supplier's key)
      let commitTx: string | null = null;
      if (body.commitOnchain && body.supplierKey && bountyContract) {
        const runtime = service.getRuntime(id);
        if (runtime.chainBountyId !== undefined) {
          commitTx = await chain.commitEvidence(
            bountyContract,
            body.supplierKey as `0x${string}`,
            BigInt(runtime.chainBountyId),
            submission.contentHash,
          );
        }
      }
      return reply.code(duplicate ? 200 : 201).send({
        submission,
        duplicate,
        commitTx,
        explorer: {
          commitTx: commitTx ? explorerTxUrl(network.explorerUrl, commitTx) : null,
        },
      });
    } catch (e) {
      if (e instanceof DuplicateError) {
        return reply.code(409).send({ error: "duplicate submission" });
      }
      throw e;
    }
  });

  app.post("/api/gaps/:id/evaluate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const evals = await service.evaluateGap(id);
    return { evaluations: evals };
  });

  app.post("/api/gaps/:id/finalize", async (req, reply) => {
    const { id } = req.params as { id: string };
    const gap = service.getGap(id);
    if (!gap) return reply.code(404).send({ error: "not found" });
    if (gap.status === "settled" || gap.status === "consumed") {
      return reply
        .code(409)
        .send({ error: "already settled", receipt: service.getReceiptByBounty(id) });
    }
    if (gap.status === "cancelled" || gap.status === "expired") {
      return reply.code(409).send({ error: `gap is ${gap.status}` });
    }
    if (!verifierKey) {
      return reply
        .code(400)
        .send({ error: "verifier key not configured on this server" });
    }
    // evaluate anything pending
    await service.evaluateGap(id);
    const plan = service.buildPlan(id);
    service.savePlan(plan);
    const runtime = service.getRuntime(id);

    // Build the receipt ONCE — its hash is anchored by finalize. settlementTx
    // is attached afterwards and excluded from receiptHash (it records where
    // the hash was anchored, which cannot be known before the tx lands).
    const receipt = service.buildReceipt(id, plan, {
      chainId: network.chainId,
      bountyContract: bountyContract ?? "0x0000000000000000000000000000000000000000",
      network: network.name,
    });
    let settlementTx: `0x${string}` | undefined;
    if (bountyContract && runtime.chainBountyId !== undefined) {
      settlementTx = await chain.finalize(
        bountyContract,
        verifierKey,
        BigInt(runtime.chainBountyId),
        plan.payouts.map((p) => ({
          recipient: p.recipient,
          amount: BigInt(p.amountUnits),
        })),
        plan.settlementHash,
        receipt.receiptHash,
      );
      receipt.settlementTx = settlementTx;
    }
    service.saveReceipt(receipt);
    service.markRuntime(id, {
      ...(settlementTx ? { settlementTxHash: settlementTx } : {}),
    });
    service.setStatus(id, "settled");
    return {
      plan,
      receipt,
      settlementTx: settlementTx ?? null,
      explorer: {
        settlementTx: settlementTx
          ? explorerTxUrl(network.explorerUrl, settlementTx)
          : null,
      },
    };
  });

  app.get("/api/gaps/:id/receipt", async (req, reply) => {
    const { id } = req.params as { id: string };
    const receipt = service.getReceiptByBounty(id);
    if (!receipt) return reply.code(404).send({ error: "no receipt" });
    return receipt;
  });

  app.get("/api/receipts", async () => ({
    receipts: service.listReceipts(),
  }));

  app.get("/api/receipts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const receipt = service.getReceipt(id);
    if (!receipt) return reply.code(404).send({ error: "not found" });
    return receipt;
  });

  app.post("/api/gaps/:id/consume", async (req, reply) => {
    const { id } = req.params as { id: string };
    const gap = service.getGap(id);
    if (!gap) return reply.code(404).send({ error: "not found" });
    if (gap.status !== "settled") {
      return reply.code(409).send({ error: `gap is ${gap.status}` });
    }
    service.setStatus(id, "consumed");
    return { gap: service.getGap(id) };
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({
        error: "validation failed",
        issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
  });

  return app;
}
