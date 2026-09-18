import type {
  EvidenceReceipt,
  EvidenceSubmission,
  GapRequest,
  GapRuntime,
  SettlementPlan,
  EvidenceEvaluation,
} from "@gap402/schemas";
import { parseUsdcAmount } from "@gap402/config";

/**
 * Gap402 client. Ergonomic surface for agent code:
 *
 *   const gap = new Gap402({ api: "http://127.0.0.1:4020" });
 *   const bounty = await gap.createGap({ question, claim, requirements, budget: "0.05" });
 *   const result = await gap.waitForEvidence(bounty.id);
 */
export interface Gap402Options {
  api: string;
  /** Requester identity attached to created gaps. */
  requester?: {
    id: string;
    kind?: "eoa" | "service" | "erc8004";
    address: `0x${string}`;
  };
  /** Private key for onchain funding. Required for onchain creation. */
  privateKey?: `0x${string}`;
  fetchImpl?: typeof fetch;
}

export interface CreateGapInput {
  question: string;
  claim: string;
  context?: string | undefined;
  requirements?: Record<string, unknown> | undefined;
  /** Human USDC amount, e.g. "0.05". Converted to 6-decimal base units. */
  budget: string;
  /** Deadline in seconds from now, or ISO timestamp. */
  deadlineSeconds?: number | undefined;
  deadline?: string | undefined;
}

export interface GapView {
  gap: GapRequest;
  runtime: GapRuntime;
  submissionCount: number;
}

export class Gap402 {
  private api: string;
  private fetchImpl: typeof fetch;
  private requester?: Gap402Options["requester"];

  constructor(opts: Gap402Options) {
    this.api = opts.api.replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.requester = opts.requester;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const res = await this.fetchImpl(`${this.api}${path}`, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Gap402Error(`${method} ${path} -> ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async createGap(input: CreateGapInput): Promise<GapView> {
    const budgetUnits = parseUsdcAmount(input.budget).toString();
    return this.req<GapView>("POST", "/api/gaps", {
      question: input.question,
      claim: input.claim,
      context: input.context,
      requirements: input.requirements ?? {},
      budgetUnits,
      requester: this.requester,
      deadline: input.deadline,
      deadlineSeconds: input.deadlineSeconds,
    });
  }

  async getGap(id: string): Promise<GapView> {
    return this.req<GapView>("GET", `/api/gaps/${id}`);
  }

  async listGaps(filter?: { status?: string }): Promise<{ gaps: GapView[] }> {
    const q = filter?.status ? `?status=${filter.status}` : "";
    return this.req("GET", `/api/gaps${q}`);
  }

  async submitEvidence(
    bountyId: string,
    evidence: {
      url: string;
      title?: string | undefined;
      publisher?: string | undefined;
      publishedAt?: string | undefined;
      excerpt?: string | undefined;
      contentHash?: `0x${string}` | undefined;
      claimRelation?: string | undefined;
      sourceType?: string | undefined;
      supplierAddress: `0x${string}`;
      supplierId?: string | undefined;
      commitOnchain?: boolean | undefined;
      /** Supplier private key; required when commitOnchain is true. */
      supplierKey?: `0x${string}` | undefined;
    },
  ): Promise<{
    submission: EvidenceSubmission;
    /** True when the API deduplicated this URL/content-hash to a prior submission. */
    duplicate: boolean;
    /** Onchain commitment tx when commitOnchain was requested. */
    commitTx: string | null;
  }> {
    return this.req("POST", `/api/gaps/${bountyId}/submissions`, evidence);
  }

  /** Mark a settled gap consumed by the requester. */
  async consumeGap(bountyId: string): Promise<{ gap: GapRequest }> {
    return this.req("POST", `/api/gaps/${bountyId}/consume`);
  }

  /** Cancel an expired gap; reclaims escrow onchain when it was funded. */
  async cancelGap(bountyId: string): Promise<{
    gap: GapRequest;
    cancelTx: string | null;
  }> {
    return this.req("POST", `/api/gaps/${bountyId}/cancel`);
  }

  async evaluateGap(bountyId: string): Promise<{ evaluations: EvidenceEvaluation[] }> {
    return this.req("POST", `/api/gaps/${bountyId}/evaluate`);
  }

  async finalizeGap(bountyId: string): Promise<{
    plan: SettlementPlan;
    receipt: EvidenceReceipt;
    settlementTx: string | null;
  }> {
    return this.req("POST", `/api/gaps/${bountyId}/finalize`);
  }

  async getReceipt(id: string): Promise<EvidenceReceipt> {
    return this.req<EvidenceReceipt>("GET", `/api/receipts/${id}`);
  }

  async getReceiptByBounty(bountyId: string): Promise<EvidenceReceipt | null> {
    const res = await this.fetchImpl(`${this.api}/api/gaps/${bountyId}/receipt`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Gap402Error(await res.text());
    return (await res.json()) as EvidenceReceipt;
  }

  /** Poll until the gap reaches `settled`/`consumed` (or timeout). */
  async waitForEvidence(
    gapId: string,
    opts: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<GapView> {
    const interval = opts.intervalMs ?? 2_000;
    const timeout = opts.timeoutMs ?? 300_000;
    const start = Date.now();
    for (;;) {
      const view = await this.getGap(gapId);
      if (
        view.gap.status === "settled" ||
        view.gap.status === "consumed" ||
        view.gap.status === "cancelled" ||
        view.gap.status === "expired"
      ) {
        return view;
      }
      if (Date.now() - start > timeout) {
        throw new Gap402Error(
          `waitForEvidence timed out after ${timeout}ms (status=${view.gap.status})`,
        );
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  async health(): Promise<{ ok: boolean; network: string; chainId: number }> {
    return this.req("GET", "/api/health");
  }
}

export class Gap402Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Gap402Error";
  }
}
