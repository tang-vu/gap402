"use client";
import {
  fmtUsdc,
  type Submission,
  type Evaluation,
  type SettlementPlan,
  type Receipt,
} from "../lib/api";
import { host } from "../lib/presentation";

/** A selectable, DOM-based trace of one returned source. Never a simulated stream. */
export function SourceJourney({
  submissions,
  evaluations,
  plan,
  receipt,
  selected,
  onSelect,
  chapter,
}: {
  submissions: Submission[];
  evaluations: Evaluation[];
  plan: SettlementPlan | null;
  receipt: Receipt | null;
  selected: string;
  onSelect: (id: string) => void;
  chapter: number;
}) {
  const index = submissions.findIndex((s) => s.id === selected);
  const source = submissions[index];
  const evaluation = evaluations.find((e) => e.submissionId === selected);
  const payout = plan?.payouts.find((p) => p.submissionId === selected);
  return (
    <div className="source-journey" role="group" aria-label="Source trace diagram">
      <div className="journey-sources">
        {submissions.map((s, i) => (
          <button
            key={s.id}
            aria-pressed={s.id === selected}
            onClick={() => onSelect(s.id)}
          >
            <span>0{i + 1}</span>
            <strong>{s.sourceType}</strong>
            <small>{host(s.canonicalUrl)}</small>
          </button>
        ))}
      </div>
      <div className="journey-connector" aria-hidden="true">
        <span>↓</span>
      </div>
      <div className="journey-trace">
        <div>
          <span className="eyebrow">Selected slip</span>
          <strong>
            {source ? `Source ${String(index + 1).padStart(2, "0")}` : "Choose a source"}
          </strong>
          <small>
            {source
              ? host(source.canonicalUrl)
              : "The list below has the complete record."}
          </small>
        </div>
        <span className="journey-arrow" aria-hidden="true">
          →
        </span>
        <div>
          <span className="eyebrow">
            {chapter < 2 ? "Declared checks" : "Recorded evaluation"}
          </span>
          <strong>
            {chapter < 2
              ? "Awaiting inspection"
              : (evaluation?.verdict ?? "Not evaluated")}
          </strong>
          <small>
            {chapter < 2
              ? "Replay starts before evaluation."
              : evaluation?.rejectReasons.join("; ") || "See individual checks below."}
          </small>
        </div>
        <span className="journey-arrow" aria-hidden="true">
          →
        </span>
        <div>
          <span className="eyebrow">
            {chapter === 4 ? "Receipt entry" : "Allocation"}
          </span>
          <strong>
            {chapter < 3
              ? "Not yet replayed"
              : chapter === 4
                ? receipt
                  ? receipt.acceptedEvidence.some((e) => e.submissionId === selected)
                    ? "Accepted entry"
                    : receipt.rejectedEvidence.some((e) => e.submissionId === selected)
                      ? "Rejected entry"
                      : "Select a source"
                  : "Not issued"
                : !source
                  ? "Select a source"
                  : plan
                    ? `${fmtUsdc(payout?.amountUnits ?? "0")} USDC`
                    : "Blocked"}
          </strong>
          <small>
            {chapter < 3
              ? "Advance to see the returned outcome."
              : plan
                ? "Traceable to the returned plan."
                : "Domain requirement unmet."}
          </small>
        </div>
      </div>
    </div>
  );
}
