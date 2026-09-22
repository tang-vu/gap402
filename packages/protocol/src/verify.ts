import {
  evidenceReceiptSchema,
  gapRequestSchema,
  settlementPlanSchema,
} from "@gap402/schemas";
import { computeReceiptHash, computeSettlementHash, computeSpecHash } from "./hashing.js";

/** Offline integrity checks. A valid bundle does not prove truth or an onchain anchor. */
export interface IntegrityResult {
  valid: boolean;
  checks: Record<string, boolean>;
}

export function verifyReceipt(input: unknown): IntegrityResult {
  const parsed = evidenceReceiptSchema.safeParse(input);
  if (!parsed.success) return { valid: false, checks: { schema: false } };
  const r = parsed.data;
  const ids = [...r.acceptedEvidence, ...r.rejectedEvidence].map((e) => e.submissionId);
  const evidencePaid = r.acceptedEvidence.reduce(
    (sum, e) => sum + BigInt(e.payoutUnits),
    0n,
  );
  const checks = {
    schema: true,
    receiptHash: computeReceiptHash(r) === r.receiptHash,
    uniqueEvidence: new Set(ids).size === ids.length,
    accounting: evidencePaid + BigInt(r.verifierFeeUnits) === BigInt(r.totalPaidUnits),
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function verifyBundle(
  input: unknown,
): IntegrityResult & { anchor: "not-checked" } {
  const doc = input as { gap?: unknown; plan?: unknown; receipt?: unknown } | null;
  const gap = gapRequestSchema.safeParse(doc?.gap);
  const plan = settlementPlanSchema.safeParse(doc?.plan);
  const receipt = evidenceReceiptSchema.safeParse(doc?.receipt);
  if (!gap.success || !plan.success || !receipt.success) {
    return { valid: false, checks: { schema: false }, anchor: "not-checked" as const };
  }
  const g = gap.data,
    p = plan.data,
    r = receipt.data;
  const paid = p.payouts.reduce((sum, item) => sum + BigInt(item.amountUnits), 0n);
  const evidencePayouts = p.payouts.filter(
    (item) => item.submissionId !== "verifier-fee",
  );
  const fees = p.payouts.filter((item) => item.submissionId === "verifier-fee");
  const checks = {
    ...verifyReceipt(r).checks,
    requestHash: computeSpecHash(g) === r.requestHash,
    settlementHash:
      computeSettlementHash(p) === r.settlementHash &&
      p.settlementHash === r.settlementHash,
    binding:
      g.id === p.bountyId &&
      g.id === r.bountyId &&
      g.claim === r.targetClaim &&
      g.requirements.claim === g.claim,
    budget:
      paid + BigInt(p.refundUnits) === BigInt(g.budgetUnits) &&
      BigInt(p.distributableUnits) + BigInt(p.verifierFeeUnits) === BigInt(g.budgetUnits),
    totals:
      paid === BigInt(p.totalPaidUnits) &&
      p.totalPaidUnits === r.totalPaidUnits &&
      p.refundUnits === r.refundUnits &&
      p.verifierFeeUnits === r.verifierFeeUnits,
    fees:
      fees.reduce((s, f) => s + BigInt(f.amountUnits), 0n) ===
        BigInt(r.verifierFeeUnits) &&
      fees.every((f) => f.recipient.toLowerCase() === g.verifierAddress.toLowerCase()),
    payouts:
      new Set(evidencePayouts.map((item) => item.submissionId)).size ===
        evidencePayouts.length &&
      evidencePayouts.every((item) =>
        r.acceptedEvidence.some(
          (e) =>
            e.submissionId === item.submissionId &&
            e.supplierAddress.toLowerCase() === item.recipient.toLowerCase() &&
            e.payoutUnits === item.amountUnits,
        ),
      ) &&
      r.acceptedEvidence.every(
        (e) =>
          e.payoutUnits === "0" ||
          evidencePayouts.some((item) => item.submissionId === e.submissionId),
      ),
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    anchor: "not-checked" as const,
  };
}
