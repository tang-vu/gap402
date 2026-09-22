/** Typed API surface mirroring the gap402 REST API (server-side fetches). */

export const API_BASE = process.env.GAP402_API ?? "http://127.0.0.1:4020";

export interface Health {
  ok: boolean;
  protocol: string;
  network: "local" | "testnet" | "mainnet";
  chainId: number;
  bountyContract: string | null;
  verifierAddress: string;
  explorer: string | null;
  settlementMode: string;
  verificationMode: string;
}

export interface Gap {
  id: string;
  question: string;
  claim: string;
  context?: string;
  requirements: Record<string, unknown>;
  budgetUnits: string;
  currency: string;
  requesterAddress: string;
  verifierAddress: string;
  createdAt: string;
  deadline: string;
  status: string;
}

export interface GapRuntime {
  specHash?: string;
  fundTxHash?: string;
  chainBountyId?: string;
  settlementTxHash?: string;
  network?: string;
}

export interface Submission {
  id: string;
  bountyId: string;
  supplierAddress: string;
  canonicalUrl: string;
  title?: string;
  publisher?: string;
  publishedAt?: string;
  contentHash: string;
  excerpt?: string;
  claimRelation: string;
  sourceType: string;
  submittedAt: string;
}

export interface Evaluation {
  id: string;
  submissionId: string;
  verdict: "accepted" | "rejected";
  rejectReasons: string[];
  scores: {
    support: number;
    provenance: number;
    independence: number;
    novelty: number;
    freshness: number;
  };
  confidence: number;
  checks: { name: string; passed: boolean; detail?: string }[];
  evaluatedAt: string;
}

export interface Payout {
  submissionId: string;
  recipient: string;
  amountUnits: string;
  shareBps: number;
  explanation: {
    quality: number;
    shareBps: number;
    capped: boolean;
    belowMinPayout: boolean;
    note?: string;
  };
}

export interface SettlementPlan {
  id: string;
  bountyId: string;
  algorithmVersion: string;
  distributableUnits: string;
  verifierFeeUnits: string;
  payouts: Payout[];
  totalPaidUnits: string;
  refundUnits: string;
  settlementHash: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  bountyId: string;
  requestHash: string;
  targetClaim: string;
  chainId: number;
  bountyContract: string;
  acceptedEvidence: {
    submissionId: string;
    url: string;
    contentHash: string;
    supplierAddress: string;
    scores: Evaluation["scores"];
    payoutUnits: string;
  }[];
  rejectedEvidence: {
    submissionId: string;
    url: string;
    contentHash: string;
    supplierAddress: string;
    reasons: string[];
  }[];
  totalPaidUnits: string;
  refundUnits: string;
  verifierFeeUnits: string;
  settlementTx?: string;
  settlementHash: string;
  receiptHash: string;
  evaluatorVersion: string;
  network: string;
  createdAt: string;
}

export interface GapView {
  gap: Gap;
  runtime: GapRuntime;
  submissionCount: number;
}

export interface GapDetail extends GapView {
  submissions: Submission[];
  evaluations: Evaluation[];
  plan: SettlementPlan | null;
  explorer: { fundTx: string | null; settlementTx: string | null };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Market request failed (${status})`);
  }
}

export const api = {
  health: () => get<Health>("/api/health"),
  listGaps: () => get<{ gaps: GapView[] }>("/api/gaps"),
  gapDetail: (id: string) => get<GapDetail>(`/api/gaps/${id}`),
  receipt: (id: string) => get<Receipt>(`/api/receipts/${id}`),
  receiptByBounty: (id: string) => get<Receipt>(`/api/gaps/${id}/receipt`),
  proof: (id: string) => get<unknown>(`/api/gaps/${encodeURIComponent(id)}/proof`),
};

export function fmtUsdc(units: string | bigint): string {
  const v = BigInt(units);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

export function short(s: string, n = 10): string {
  return s.length <= n * 2 + 2 ? s : `${s.slice(0, n)}…${s.slice(-n)}`;
}
