import type { GapView, SettlementPlan } from "./api";

/** Ratio is only for drawing. Money never leaves bigint arithmetic. */
export function ratio(amount: string, total: string): number {
  const denominator = BigInt(total);
  return denominator > 0n ? Number((BigInt(amount) * 10000n) / denominator) / 100 : 0;
}
export function accounting(plan: SettlementPlan, budget?: string) {
  const paid = plan.payouts.reduce((sum, p) => sum + BigInt(p.amountUnits), 0n);
  const fee = plan.payouts
    .filter((p) => p.submissionId === "verifier-fee")
    .reduce((sum, p) => sum + BigInt(p.amountUnits), 0n);
  const total =
    budget === undefined
      ? BigInt(plan.distributableUnits) + BigInt(plan.verifierFeeUnits)
      : BigInt(budget);
  return {
    paid,
    fee,
    suppliers: paid - fee,
    refund: BigInt(plan.refundUnits),
    total,
    reconciled:
      paid + BigInt(plan.refundUnits) === total &&
      fee === BigInt(plan.verifierFeeUnits) &&
      paid === BigInt(plan.totalPaidUnits),
  };
}
export function safeUrl(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function host(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value || "Unknown source";
  }
}
export function utcDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown deadline"
    : `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
export function register(gaps: GapView[], query: string, status: string, sort: string) {
  return gaps
    .filter(
      ({ gap }) =>
        (status === "all" || gap.status === status) &&
        `${gap.claim} ${gap.id}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "budget")
        return BigInt(a.gap.budgetUnits) === BigInt(b.gap.budgetUnits)
          ? a.gap.id.localeCompare(b.gap.id)
          : BigInt(a.gap.budgetUnits) > BigInt(b.gap.budgetUnits)
            ? -1
            : 1;
      if (sort === "sources") return b.submissionCount - a.submissionCount;
      return a.gap.deadline.localeCompare(b.gap.deadline);
    });
}
const requirementLabels: Record<string, string> = {
  allowedSourceTypes: "Allowed source types",
  bannedSourceTypes: "Excluded source types",
  maxSourceAgeSeconds: "Maximum source age",
  minPublishedAt: "Published on or after",
  requirePrimarySource: "Primary source required",
  requireIndependentSources: "Independent sources required",
  minIndependentSources: "Minimum distinct qualifying domains",
  geographicConstraints: "Geography",
  languages: "Languages",
  domainAllowlist: "Allowed domains",
  domainBlocklist: "Excluded domains",
  expectedEvidenceType: "Evidence format",
  minSupportScore: "Minimum support score",
  rejectDuplicates: "Reject duplicate evidence",
  requireCitation: "Citation required",
};
export function readableRequirements(requirements: Record<string, unknown>) {
  return Object.entries(requirements)
    .filter(([key]) => key !== "claim")
    .map(([key, value]) => ({
      label: requirementLabels[key] ?? key,
      value:
        key === "maxSourceAgeSeconds" && typeof value === "number"
          ? `${value / 86400} days`
          : key === "minSupportScore" && typeof value === "number"
            ? `${value.toLocaleString("en-US")} / 1,000,000`
            : typeof value === "boolean"
              ? value
                ? "Yes"
                : "No"
              : Array.isArray(value)
                ? value.join(", ") || "None specified"
                : typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value ?? "Not specified"),
    }));
}
