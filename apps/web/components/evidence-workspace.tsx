"use client";
import { useState } from "react";
import {
  fmtUsdc,
  type Submission,
  type Evaluation,
  type SettlementPlan,
  type Receipt,
} from "../lib/api";
import { host, safeUrl } from "../lib/presentation";
import { Allocation } from "./allocation";
export function EvidenceWorkspace({
  submissions,
  evaluations,
  plan,
  receipt,
  selected,
  onSelect,
  showAllocation = true,
}: {
  submissions: Submission[];
  evaluations: Evaluation[];
  plan: SettlementPlan | null;
  receipt?: Receipt | null | undefined;
  selected?: string;
  onSelect?: (id: string) => void;
  showAllocation?: boolean;
}) {
  const [local, setLocal] = useState(submissions[0]?.id ?? "");
  const id = selected ?? local;
  const source = submissions.find((s) => s.id === id);
  const evaluation = evaluations.find((e) => e.submissionId === id);
  const payout = plan?.payouts.find((p) => p.submissionId === id);
  function select(value: string) {
    setLocal(value);
    onSelect?.(value);
  }
  return (
    <div className="evidence-workspace">
      <div className="evidence-heading">
        <h2>The source desk.</h2>
        <span className="mono">{submissions.length} submissions / select to inspect</span>
      </div>
      {submissions.length ? (
        <div className="source-desk">
          <div className="source-list" role="group" aria-label="Evidence sources">
            {submissions.map((s, i) => {
              const e = evaluations.find((item) => item.submissionId === s.id);
              return (
                <button
                  key={s.id}
                  className={`source-card ${id === s.id ? "selected" : ""}`}
                  aria-pressed={id === s.id}
                  onClick={() => select(s.id)}
                >
                  <span className="source-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="source-card-copy">
                    <span className="eyebrow">
                      {s.sourceType} / {host(s.canonicalUrl)}
                    </span>
                    <strong>{s.title ?? "Untitled evidence"}</strong>
                    <span
                      className={`pill ${e?.verdict === "accepted" ? "ok" : e ? "bad" : "warn"}`}
                    >
                      {e?.verdict ?? "Awaiting evaluation"}
                    </span>
                  </span>
                  <span className="source-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              );
            })}
          </div>
          <article className="source-inspector" aria-label="Selected source inspector">
            <p className="eyebrow">
              Inspection /{" "}
              {source
                ? `Source ${String(submissions.indexOf(source) + 1).padStart(2, "0")}`
                : "Allocation"}
            </p>
            {source ? (
              <>
                <h3>{source.title ?? "Untitled evidence"}</h3>
                <a
                  className="source-url"
                  href={safeUrl(source.canonicalUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.canonicalUrl} ↗
                </a>
                <p>
                  {evaluation
                    ? evaluation.rejectReasons.join("; ") ||
                      "Accepted by the recorded evaluation. Scores describe evaluation quality, not probability of factual truth."
                    : "No evaluation is recorded. Acceptance and payout are not yet known."}
                </p>
                <div className="source-outcome">
                  <span>
                    Allocation
                    <strong>
                      {plan
                        ? `${fmtUsdc(payout?.amountUnits ?? "0")} USDC`
                        : "Not planned"}
                    </strong>
                  </span>
                  <span>
                    Receipt entry
                    <strong>
                      {receipt
                        ? receipt.acceptedEvidence.some((e) => e.submissionId === id)
                          ? "Accepted evidence"
                          : receipt.rejectedEvidence.some((e) => e.submissionId === id)
                            ? "Rejected evidence"
                            : "Not included"
                        : receipt === undefined
                          ? "Unknown"
                          : "Not issued"}
                    </strong>
                  </span>
                </div>
                {payout && (
                  <p className="allocation-note">
                    {payout.explanation.note ??
                      `Quality ${payout.explanation.quality} / 1,000,000; ${payout.explanation.shareBps} basis points; ${payout.explanation.capped ? "share capped" : "uncapped"}; ${payout.explanation.belowMinPayout ? "below minimum payout" : "meets payout floor"}.`}
                  </p>
                )}
                {plan && !payout && (
                  <p className="allocation-note">
                    No direct payout row is recorded for this submission. Acceptance alone
                    does not guarantee a reward; the allocator groups contributions by
                    recipient and applies caps and payout floors.
                  </p>
                )}
                {evaluation && (
                  <>
                    <h4>Recorded checks</h4>
                    <ul className="check-list">
                      {evaluation.checks.map((c, i) => (
                        <li key={i}>
                          <span className={c.passed ? "check-pass" : "check-fail"}>
                            {c.passed ? "Pass" : "Fail"}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.detail ?? "No additional detail recorded."}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <details>
                      <summary>All five evaluation scores</summary>
                      <dl className="score-list">
                        {Object.entries(evaluation.scores).map(([name, score]) => (
                          <div key={name}>
                            <dt>{name}</dt>
                            <dd>{score.toLocaleString("en-US")} / 1,000,000</dd>
                          </div>
                        ))}
                      </dl>
                      <p>These scores are not probabilities of truth.</p>
                    </details>
                  </>
                )}
                <details>
                  <summary>Source identity, timestamps & content hash</summary>
                  <dl className="kv">
                    <dt>Supplier</dt>
                    <dd className="mono">{source.supplierAddress}</dd>
                    <dt>Submission</dt>
                    <dd className="mono">{source.id}</dd>
                    <dt>Publisher</dt>
                    <dd>{source.publisher ?? "Not supplied"}</dd>
                    <dt>Published</dt>
                    <dd>{source.publishedAt ?? "Unknown"}</dd>
                    <dt>Submitted</dt>
                    <dd>{source.submittedAt}</dd>
                    <dt>Evaluated</dt>
                    <dd>{evaluation?.evaluatedAt ?? "Not evaluated"}</dd>
                    <dt>Relation</dt>
                    <dd>{source.claimRelation}</dd>
                    <dt>Content hash</dt>
                    <dd className="mono">{source.contentHash}</dd>
                  </dl>
                </details>
              </>
            ) : (
              <p>
                Select a source to connect its checks, allocation and receipt inclusion.
              </p>
            )}
          </article>
        </div>
      ) : (
        <div className="empty-market">
          <h3>The dossier is open.</h3>
          <p>
            No evidence has been submitted. The declared requirements remain available
            above.
          </p>
        </div>
      )}
      {showAllocation && plan && (
        <Allocation
          plan={plan}
          submissions={submissions}
          selected={id}
          onSelect={select}
        />
      )}
    </div>
  );
}
