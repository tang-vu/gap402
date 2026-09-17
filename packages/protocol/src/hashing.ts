import { keccak256, stringToHex, type Hex } from "viem";
import {
  gapRequestSchema,
  settlementPlanSchema,
  evidenceReceiptSchema,
  type GapRequest,
  type SettlementPlan,
  type EvidenceReceipt,
} from "@gap402/schemas";
import { canonicalize } from "./canonical.js";

export function hashCanonical(value: unknown): Hex {
  return keccak256(stringToHex(canonicalize(value)));
}

export function hashText(text: string): Hex {
  return keccak256(stringToHex(text));
}

/**
 * specHash commits the requester to the exact bounty specification:
 * the validated GapRequest minus lifecycle status (status is runtime state,
 * not part of the spec).
 */
export function computeSpecHash(gap: GapRequest): Hex {
  const parsed = gapRequestSchema.parse(gap);
  const { status: _status, ...spec } = parsed;
  return hashCanonical(spec);
}

export function computeSettlementHash(plan: SettlementPlan): Hex {
  const { settlementHash: _drop, ...rest } = settlementPlanSchema.parse(plan);
  return hashCanonical(rest);
}

/**
 * receiptHash commits to the receipt's content. `settlementTx` is excluded:
 * it records WHERE the hash was anchored, which cannot be known until the
 * anchor transaction lands — the hash must be computable beforehand.
 */
export function computeReceiptHash(receipt: EvidenceReceipt): Hex {
  const {
    receiptHash: _drop,
    settlementTx: _tx,
    ...rest
  } = evidenceReceiptSchema.parse(receipt);
  return hashCanonical(rest);
}
