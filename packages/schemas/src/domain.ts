import { z } from "zod";
import {
  PROTOCOL_ID,
  PROTOCOL_VERSION,
  bpsSchema,
  bytes32Schema,
  evmAddressSchema,
  idSchema,
  isoTimestampSchema,
  scoreSchema,
  txHashSchema,
  urlSchema,
  usdcUnitsSchema,
} from "./primitives.js";

/* ── AgentIdentity ─────────────────────────────────────────────────── */

export const agentIdentitySchema = z.object({
  /** Stable identifier. EVM address, did:pkh, or service id. */
  id: z.string().min(1).max(256),
  kind: z.enum(["eoa", "erc8004", "service", "anonymous"]),
  label: z.string().max(128).optional(),
  walletAddress: evmAddressSchema.optional(),
});
export type AgentIdentity = z.infer<typeof agentIdentitySchema>;

/* ── BountyStatus ──────────────────────────────────────────────────── */

export const bountyStatusSchema = z.enum([
  "detected", // gap identified, not yet funded
  "funded", // escrow tx confirmed
  "open", // accepting submissions
  "submissions", // at least one submission received
  "verified", // evaluation complete
  "settled", // onchain settlement executed
  "consumed", // requester ingested the receipt
  "expired", // deadline passed without settlement
  "cancelled", // requester cancelled and reclaimed escrow
]);
export type BountyStatus = z.infer<typeof bountyStatusSchema>;

/* ── EvidenceRequirement ───────────────────────────────────────────── */

export const sourceTypeSchema = z.enum([
  "official", // issuer's own domain / filings / docs
  "primary", // first-hand reporting or source material
  "independent", // third-party reporting
  "aggregated", // reposts, aggregators, wire mirrors
  "social",
  "wiki",
  "unknown",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const evidenceRequirementSchema = z.object({
  /** The exact claim that evidence must address. */
  claim: z.string().min(1).max(2048),
  allowedSourceTypes: z.array(sourceTypeSchema).optional(),
  bannedSourceTypes: z.array(sourceTypeSchema).optional(),
  /** Max age of the evidence, seconds since publishedAt. */
  maxSourceAgeSeconds: z.number().int().positive().optional(),
  /** Evidence must be published at/after this time. */
  minPublishedAt: isoTimestampSchema.optional(),
  requirePrimarySource: z.boolean().default(false),
  requireIndependentSources: z.boolean().default(false),
  minIndependentSources: z.number().int().min(0).default(0),
  geographicConstraints: z.array(z.string().max(64)).optional(),
  languages: z.array(z.string().max(16)).optional(),
  domainAllowlist: z.array(z.string().max(253)).optional(),
  domainBlocklist: z.array(z.string().max(253)).optional(),
  expectedEvidenceType: z
    .enum(["article", "document", "dataset", "api-response", "any"])
    .default("any"),
  /** Minimum claim-support score for acceptance. */
  minSupportScore: scoreSchema.default(500_000),
  rejectDuplicates: z.boolean().default(true),
  requireCitation: z.boolean().default(true),
});
export type EvidenceRequirement = z.infer<typeof evidenceRequirementSchema>;

/* ── GapRequest ────────────────────────────────────────────────────── */

export const gapRequestSchema = z.object({
  protocol: z.literal(PROTOCOL_ID),
  version: z.literal(PROTOCOL_VERSION),
  id: idSchema,
  question: z.string().min(1).max(4096),
  claim: z.string().min(1).max(2048),
  context: z.string().max(8192).optional(),
  requirements: evidenceRequirementSchema,
  budgetUnits: usdcUnitsSchema,
  currency: z.literal("USDC"),
  requester: agentIdentitySchema,
  requesterAddress: evmAddressSchema,
  verifierAddress: evmAddressSchema,
  createdAt: isoTimestampSchema,
  deadline: isoTimestampSchema,
  status: bountyStatusSchema,
});
export type GapRequest = z.infer<typeof gapRequestSchema>;

/** Runtime bookkeeping attached to a gap (not part of specHash). */
export const gapRuntimeSchema = z.object({
  specHash: bytes32Schema.optional(),
  chainBountyId: z.string().optional(),
  fundTxHash: txHashSchema.optional(),
  settlementTxHash: txHashSchema.optional(),
  network: z.enum(["local", "testnet", "mainnet"]).optional(),
});
export type GapRuntime = z.infer<typeof gapRuntimeSchema>;

/* ── EvidenceSubmission ────────────────────────────────────────────── */

export const claimRelationSchema = z.enum([
  "supports",
  "contradicts",
  "contextual",
  "unrelated",
  "unknown",
]);
export type ClaimRelation = z.infer<typeof claimRelationSchema>;

export const evidenceSubmissionSchema = z.object({
  protocol: z.literal(PROTOCOL_ID),
  version: z.literal(PROTOCOL_VERSION),
  id: idSchema,
  bountyId: idSchema,
  supplier: agentIdentitySchema,
  supplierAddress: evmAddressSchema,
  /** Canonical normalized URL used for dedup. */
  canonicalUrl: urlSchema,
  originalUrl: urlSchema.optional(),
  title: z.string().max(512).optional(),
  publisher: z.string().max(256).optional(),
  publishedAt: isoTimestampSchema.optional(),
  retrievedAt: isoTimestampSchema,
  /** keccak256 of the normalized retrieved content/excerpt. */
  contentHash: bytes32Schema,
  /** Short excerpt (<= 2000 chars). Never store full copyrighted text. */
  excerpt: z.string().max(2000).optional(),
  claimRelation: claimRelationSchema.default("unknown"),
  sourceType: sourceTypeSchema.default("unknown"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  signature: z.string().optional(),
  /** Declared supplier cost metadata (informational). */
  costUnits: usdcUnitsSchema.optional(),
  submittedAt: isoTimestampSchema,
});
export type EvidenceSubmission = z.infer<typeof evidenceSubmissionSchema>;

/* ── EvidenceEvaluation ────────────────────────────────────────────── */

export const scoreFactorsSchema = z.object({
  /** Does the source support the target claim? */
  support: scoreSchema,
  /** Provenance quality of the source (primary > independent > aggregated). */
  provenance: scoreSchema,
  /** Independence vs other submissions / the requester. */
  independence: scoreSchema,
  /** Novelty — new information vs duplicates/near-dupes. */
  novelty: scoreSchema,
  /** Freshness vs maxSourceAge / minPublishedAt requirements. */
  freshness: scoreSchema,
});
export type ScoreFactors = z.infer<typeof scoreFactorsSchema>;

export const checkResultSchema = z.object({
  name: z.string().min(1).max(64),
  passed: z.boolean(),
  detail: z.string().max(1024).optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const evidenceEvaluationSchema = z.object({
  protocol: z.literal(PROTOCOL_ID),
  version: z.literal(PROTOCOL_VERSION),
  id: idSchema,
  submissionId: idSchema,
  bountyId: idSchema,
  verdict: z.enum(["accepted", "rejected"]),
  rejectReasons: z.array(z.string().max(256)).default([]),
  scores: scoreFactorsSchema,
  /** Verifier confidence in this evaluation. */
  confidence: scoreSchema,
  checks: z.array(checkResultSchema),
  evaluatorVersion: z.string().max(64),
  evaluatedAt: isoTimestampSchema,
  modelResponseHash: bytes32Schema.optional(),
});
export type EvidenceEvaluation = z.infer<typeof evidenceEvaluationSchema>;

/* ── SettlementPlan ────────────────────────────────────────────────── */

export const payoutExplanationSchema = z.object({
  factors: scoreFactorsSchema,
  /** quality = normalized product of factors, fixed-point 1e6. */
  quality: scoreSchema,
  shareBps: bpsSchema,
  capped: z.boolean(),
  belowMinPayout: z.boolean(),
  note: z.string().max(512).optional(),
});
export type PayoutExplanation = z.infer<typeof payoutExplanationSchema>;

export const payoutSchema = z.object({
  submissionId: idSchema,
  recipient: evmAddressSchema,
  amountUnits: usdcUnitsSchema,
  shareBps: bpsSchema,
  explanation: payoutExplanationSchema,
});
export type Payout = z.infer<typeof payoutSchema>;

export const settlementPlanSchema = z.object({
  protocol: z.literal(PROTOCOL_ID),
  version: z.literal(PROTOCOL_VERSION),
  id: idSchema,
  bountyId: idSchema,
  algorithmVersion: z.string().max(64),
  distributableUnits: usdcUnitsSchema,
  verifierFeeUnits: usdcUnitsSchema,
  verifierAddress: evmAddressSchema.optional(),
  payouts: z.array(payoutSchema),
  totalPaidUnits: usdcUnitsSchema,
  /** Deterministic refund back to requester (bounty - paid - fee). */
  refundUnits: usdcUnitsSchema,
  settlementHash: bytes32Schema,
  createdAt: isoTimestampSchema,
});
export type SettlementPlan = z.infer<typeof settlementPlanSchema>;

/* ── EvidenceReceipt ───────────────────────────────────────────────── */

export const receiptEvidenceSchema = z.object({
  submissionId: idSchema,
  url: urlSchema,
  contentHash: bytes32Schema,
  supplier: agentIdentitySchema,
  supplierAddress: evmAddressSchema,
  scores: scoreFactorsSchema,
  payoutUnits: usdcUnitsSchema,
});
export type ReceiptEvidence = z.infer<typeof receiptEvidenceSchema>;

export const rejectedEvidenceSchema = z.object({
  submissionId: idSchema,
  url: urlSchema.optional(),
  contentHash: bytes32Schema.optional(),
  supplierAddress: evmAddressSchema,
  reasons: z.array(z.string().max(256)),
});
export type RejectedEvidence = z.infer<typeof rejectedEvidenceSchema>;

export const evidenceReceiptSchema = z.object({
  protocol: z.literal(PROTOCOL_ID),
  version: z.literal(PROTOCOL_VERSION),
  id: idSchema,
  bountyId: idSchema,
  requestHash: bytes32Schema,
  targetClaim: z.string().min(1).max(2048),
  chainId: z.number().int().positive(),
  bountyContract: evmAddressSchema,
  acceptedEvidence: z.array(receiptEvidenceSchema),
  rejectedEvidence: z.array(rejectedEvidenceSchema),
  totalPaidUnits: usdcUnitsSchema,
  refundUnits: usdcUnitsSchema,
  verifierFeeUnits: usdcUnitsSchema,
  settlementTx: txHashSchema.optional(),
  settlementHash: bytes32Schema,
  receiptHash: bytes32Schema,
  evaluatorVersion: z.string().max(64),
  network: z.enum(["local", "testnet", "mainnet"]),
  createdAt: isoTimestampSchema,
});
export type EvidenceReceipt = z.infer<typeof evidenceReceiptSchema>;
