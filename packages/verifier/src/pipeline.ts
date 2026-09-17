import { randomUUID } from "node:crypto";
import {
  type CheckResult,
  type EvidenceEvaluation,
  type EvidenceSubmission,
  type GapRequest,
} from "@gap402/schemas";
import {
  runDeterministicChecks,
  deterministicRejectReasons,
  provenanceScore,
  freshnessScore,
  independenceScore,
  noveltyScore,
  type DeterministicContext,
} from "./deterministic.js";
import {
  type SemanticProvider,
  MockSemanticProvider,
  hashModelResponse,
} from "./semantic.js";

export const EVALUATOR_VERSION = "gap402-verifier-1.0.0";

/**
 * Full evaluation pipeline:
 *   deterministic checks -> (fail fast => reject) -> semantic scoring ->
 *   final verdict + score factors.
 */
export async function evaluateSubmission(
  sub: EvidenceSubmission,
  ctx: DeterministicContext & {
    semantic?: SemanticProvider;
    evaluationId?: string;
    now?: Date;
  },
): Promise<EvidenceEvaluation> {
  const now = ctx.now ?? new Date();
  const req = ctx.gap.requirements;
  const checks: CheckResult[] = runDeterministicChecks(sub, ctx);
  const rejectReasons = deterministicRejectReasons(checks);

  const semantic = ctx.semantic ?? new MockSemanticProvider();
  let support = 0;
  let confidence = 0;
  let modelResponseHash: `0x${string}` | undefined;

  if (rejectReasons.length === 0) {
    const { verdict, raw } = await semantic.evaluate({
      claim: req.claim,
      evidence: sub,
      gap: ctx.gap,
    });
    modelResponseHash = hashModelResponse(raw);
    support = Math.round(verdict.support * 1_000_000);
    confidence = Math.round(verdict.confidence * 1_000_000);
    checks.push({
      name: "semantic_support",
      passed: verdict.support * 1_000_000 >= req.minSupportScore,
      detail: `support=${support} min=${req.minSupportScore} relation=${verdict.relation} provider=${semantic.name}`,
    });
    if (verdict.support * 1_000_000 < req.minSupportScore) {
      rejectReasons.push(`support ${support} below minimum ${req.minSupportScore}`);
    }
    if (verdict.relation === "contradicts") {
      rejectReasons.push("evidence contradicts the claim");
      checks.push({
        name: "not_contradictory",
        passed: false,
        detail: "semantic verdict: contradicts",
      });
    }
  } else {
    checks.push({
      name: "semantic_support",
      passed: false,
      detail: "skipped: deterministic checks failed",
    });
  }

  const accepted = rejectReasons.length === 0;
  return {
    protocol: "gap402",
    version: "1",
    id: ctx.evaluationId ?? `ev_${randomUUID().replace(/-/g, "")}`,
    submissionId: sub.id,
    bountyId: sub.bountyId,
    verdict: accepted ? "accepted" : "rejected",
    rejectReasons,
    scores: {
      support,
      provenance: provenanceScore(sub),
      independence: independenceScore(sub, ctx),
      novelty: noveltyScore(sub, ctx),
      freshness: freshnessScore(sub, req, now),
    },
    confidence,
    checks,
    evaluatorVersion: `${EVALUATOR_VERSION}+${semantic.name}`,
    evaluatedAt: now.toISOString(),
    ...(modelResponseHash ? { modelResponseHash } : {}),
  };
}
