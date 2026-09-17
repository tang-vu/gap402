import { randomUUID } from "node:crypto";
import {
  evidenceRequirementSchema,
  evidenceSubmissionSchema,
  gapRequestSchema,
  type EvidenceEvaluation,
  type EvidenceReceipt,
  type EvidenceRequirement,
  type EvidenceSubmission,
  type GapRequest,
  type GapRuntime,
  type SettlementPlan,
} from "@gap402/schemas";
import { computeReceiptHash, computeSpecHash } from "@gap402/protocol";
import { canonicalizeUrl, contentHashOf, sanitizeForPrompt } from "@gap402/evidence";
import {
  evaluateSubmission,
  providerFromEnv,
  type SemanticProvider,
} from "@gap402/verifier";
import { buildSettlementPlan } from "@gap402/settlement";
import type { Store } from "./store.js";

const nid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

export interface CreateGapInput {
  question: string;
  claim: string;
  context?: string | undefined;
  requirements?: Partial<EvidenceRequirement> | undefined;
  budgetUnits: string;
  requesterAddress: `0x${string}`;
  requesterId?: string | undefined;
  requesterKind?: "eoa" | "service" | "erc8004" | "anonymous" | undefined;
  deadline?: string | undefined;
  deadlineSeconds?: number | undefined;
}

export class GapService {
  constructor(
    private store: Store,
    private verifierAddress: `0x${string}`,
    private semantic?: SemanticProvider,
  ) {}

  private get semanticProvider(): SemanticProvider {
    return (this.semantic ??= providerFromEnv());
  }

  createGap(input: CreateGapInput): { gap: GapRequest; runtime: GapRuntime } {
    const now = new Date();
    const deadline = input.deadline
      ? new Date(input.deadline)
      : new Date(now.getTime() + (input.deadlineSeconds ?? 3600) * 1000);
    const requirements = evidenceRequirementSchema.parse({
      claim: input.claim,
      ...input.requirements,
    });
    const gap = gapRequestSchema.parse({
      protocol: "gap402",
      version: "1",
      id: nid("gap"),
      question: input.question,
      claim: input.claim,
      context: input.context,
      requirements,
      budgetUnits: input.budgetUnits,
      currency: "USDC",
      requester: {
        id: input.requesterId ?? input.requesterAddress,
        kind: input.requesterKind ?? "service",
        walletAddress: input.requesterAddress,
      },
      requesterAddress: input.requesterAddress,
      verifierAddress: this.verifierAddress,
      createdAt: now.toISOString(),
      deadline: deadline.toISOString(),
      status: "detected",
    });
    const specHash = computeSpecHash(gap);
    this.store.put("gap", gap);
    const runtime: GapRuntime = { specHash };
    this.store.put("runtime", { id: gap.id, ...runtime }, gap.id);
    return { gap, runtime };
  }

  markRuntime(gapId: string, patch: Partial<GapRuntime>): GapRuntime {
    const cur = this.store.get<GapRuntime & { id: string }>("runtime", gapId) ?? {
      id: gapId,
    };
    const next = { ...cur, ...patch };
    this.store.put("runtime", next, gapId);
    return next;
  }

  getRuntime(gapId: string): GapRuntime {
    const row = this.store.get<GapRuntime & { id: string }>("runtime", gapId);
    if (!row) return {};
    const { id: _id, ...runtime } = row;
    return runtime;
  }

  getGap(id: string): GapRequest | null {
    return this.store.get<GapRequest>("gap", id);
  }

  setStatus(id: string, status: GapRequest["status"]): GapRequest {
    const gap = this.getGap(id);
    if (!gap) throw new Error(`gap ${id} not found`);
    const next = { ...gap, status };
    this.store.put("gap", next);
    return next;
  }

  listGaps(): GapRequest[] {
    return this.store.list<GapRequest>("gap");
  }

  /* ── submissions ────────────────────────────────────────────────── */

  submitEvidence(
    gapId: string,
    input: {
      url: string;
      title?: string | undefined;
      publisher?: string | undefined;
      publishedAt?: string | undefined;
      excerpt?: string | undefined;
      content?: string | undefined;
      contentHash?: `0x${string}` | undefined;
      claimRelation?: EvidenceSubmission["claimRelation"] | undefined;
      sourceType?: EvidenceSubmission["sourceType"] | undefined;
      supplierAddress: `0x${string}`;
      supplierId?: string | undefined;
      costUnits?: string | undefined;
    },
  ): { submission: EvidenceSubmission; duplicate: boolean } {
    const gap = this.getGap(gapId);
    if (!gap) throw new Error(`gap ${gapId} not found`);
    if (new Date() > new Date(gap.deadline)) {
      throw new Error("bounty deadline has passed");
    }
    if (!["open", "submissions", "funded"].includes(gap.status)) {
      throw new Error(`bounty not accepting submissions (${gap.status})`);
    }

    const canonicalUrl = canonicalizeUrl(input.url);
    const contentHash =
      input.contentHash ?? contentHashOf(input.excerpt ?? input.content ?? input.url);

    const existing = this.store.findSubmissionByUrl<EvidenceSubmission>(
      gapId,
      canonicalUrl,
    );
    if (existing) return { submission: existing, duplicate: true };

    const submission = evidenceSubmissionSchema.parse({
      protocol: "gap402",
      version: "1",
      id: nid("sub"),
      bountyId: gapId,
      supplier: {
        id: input.supplierId ?? input.supplierAddress,
        kind: "service",
        walletAddress: input.supplierAddress,
      },
      supplierAddress: input.supplierAddress,
      canonicalUrl,
      originalUrl: input.url !== canonicalUrl ? input.url : undefined,
      title: input.title ? sanitizeForPrompt(input.title, 512) : undefined,
      publisher: input.publisher,
      publishedAt: input.publishedAt,
      retrievedAt: new Date().toISOString(),
      contentHash,
      excerpt: input.excerpt ? sanitizeForPrompt(input.excerpt, 2000) : undefined,
      claimRelation: input.claimRelation ?? "unknown",
      sourceType: input.sourceType ?? "unknown",
      costUnits: input.costUnits,
      submittedAt: new Date().toISOString(),
    });
    this.store.insert("submission", submission, gapId);
    if (gap.status === "open" || gap.status === "funded") {
      this.setStatus(gapId, "submissions");
    }
    return { submission, duplicate: false };
  }

  listSubmissions(gapId: string): EvidenceSubmission[] {
    return this.store.list<EvidenceSubmission>("submission", gapId);
  }

  /* ── evaluation ─────────────────────────────────────────────────── */

  async evaluateGap(gapId: string): Promise<EvidenceEvaluation[]> {
    const gap = this.getGap(gapId);
    if (!gap) throw new Error(`gap ${gapId} not found`);
    const subs = this.listSubmissions(gapId);
    const priorEvals = this.listEvaluations(gapId);
    const evaluatedIds = new Set(priorEvals.map((e) => e.submissionId));
    // prior submissions = those already evaluated + all earlier in order
    const prior: EvidenceSubmission[] = subs.filter((s) => evaluatedIds.has(s.id));
    const out: EvidenceEvaluation[] = [...priorEvals];
    for (const sub of subs) {
      if (evaluatedIds.has(sub.id)) continue;
      const ev = await evaluateSubmission(sub, {
        gap,
        existing: prior,
        semantic: this.semanticProvider,
        now: new Date(),
      });
      this.store.put("evaluation", ev, gapId);
      prior.push(sub);
      out.push(ev);
    }
    if (subs.length > 0 && ["submissions", "open"].includes(gap.status)) {
      this.setStatus(gapId, "verified");
    }
    return out;
  }

  listEvaluations(gapId: string): EvidenceEvaluation[] {
    return this.store
      .list<EvidenceEvaluation>("evaluation", gapId)
      .filter((e) => e.bountyId === gapId);
  }

  /* ── settlement + receipt ───────────────────────────────────────── */

  buildPlan(
    gapId: string,
    opts?: {
      verifierFeeBps?: number;
    },
  ): SettlementPlan {
    const gap = this.getGap(gapId);
    if (!gap) throw new Error(`gap ${gapId} not found`);
    const subs = this.listSubmissions(gapId);
    const evals = this.listEvaluations(gapId);
    const plan = buildSettlementPlan({
      planId: nid("plan"),
      bountyId: gapId,
      bountyUnits: BigInt(gap.budgetUnits),
      submissions: subs,
      evaluations: evals,
      policy: {
        verifierAddress: gap.verifierAddress,
        ...(opts?.verifierFeeBps !== undefined
          ? { verifierFeeBps: opts.verifierFeeBps }
          : {}),
      },
      createdAt: new Date().toISOString(),
    });
    return plan;
  }

  savePlan(plan: SettlementPlan): void {
    this.store.put("plan", plan, plan.bountyId);
  }

  getPlan(gapId: string): SettlementPlan | null {
    const plans = this.store.list<SettlementPlan>("plan", gapId);
    return plans[plans.length - 1] ?? null;
  }

  buildReceipt(
    gapId: string,
    plan: SettlementPlan,
    ctx: {
      chainId: number;
      bountyContract: `0x${string}`;
      settlementTx?: `0x${string}`;
      network: "local" | "testnet" | "mainnet";
    },
  ): EvidenceReceipt {
    const gap = this.getGap(gapId)!;
    const runtime = this.store.get<GapRuntime & { id: string }>("runtime", gapId);
    const subs = this.listSubmissions(gapId);
    const evals = this.listEvaluations(gapId);
    const evalBySub = new Map(evals.map((e) => [e.submissionId, e]));
    const payoutBySub = new Map(
      plan.payouts
        .filter((p) => p.submissionId !== "verifier-fee")
        .map((p) => [p.submissionId, p]),
    );

    const acceptedEvidence = subs
      .filter((s) => evalBySub.get(s.id)?.verdict === "accepted")
      .map((s) => ({
        submissionId: s.id,
        url: s.canonicalUrl,
        contentHash: s.contentHash,
        supplier: s.supplier,
        supplierAddress: s.supplierAddress,
        scores: evalBySub.get(s.id)!.scores,
        payoutUnits: payoutBySub.get(s.id)?.amountUnits ?? "0",
      }));

    const rejectedEvidence = subs
      .filter((s) => evalBySub.get(s.id)?.verdict === "rejected")
      .map((s) => ({
        submissionId: s.id,
        url: s.canonicalUrl,
        contentHash: s.contentHash,
        supplierAddress: s.supplierAddress,
        reasons: evalBySub.get(s.id)!.rejectReasons,
      }));

    const receiptBase = {
      protocol: "gap402" as const,
      version: "1" as const,
      id: nid("rcpt"),
      bountyId: gapId,
      requestHash: runtime?.specHash ?? computeSpecHash(gap),
      targetClaim: gap.claim,
      chainId: ctx.chainId,
      bountyContract: ctx.bountyContract,
      acceptedEvidence,
      rejectedEvidence,
      totalPaidUnits: plan.totalPaidUnits,
      refundUnits: plan.refundUnits,
      verifierFeeUnits: plan.verifierFeeUnits,
      ...(ctx.settlementTx ? { settlementTx: ctx.settlementTx } : {}),
      settlementHash: plan.settlementHash,
      receiptHash: ("0x" + "0".repeat(64)) as `0x${string}`,
      evaluatorVersion: "gap402-verifier-1.0.0",
      network: ctx.network,
      createdAt: new Date().toISOString(),
    };
    const receiptHash = computeReceiptHash(receiptBase as EvidenceReceipt);
    return { ...receiptBase, receiptHash };
  }

  saveReceipt(r: EvidenceReceipt): void {
    this.store.put("receipt", r, r.bountyId);
  }

  getReceipt(id: string): EvidenceReceipt | null {
    return this.store.get<EvidenceReceipt>("receipt", id);
  }

  listReceipts(): EvidenceReceipt[] {
    return this.store.list<EvidenceReceipt>("receipt");
  }

  getReceiptByBounty(bountyId: string): EvidenceReceipt | null {
    const list = this.store.list<EvidenceReceipt>("receipt", bountyId);
    return list[list.length - 1] ?? null;
  }
}

export { canonicalizeUrl };
