"use client";
import { useState } from "react";
import { fmtUsdc, type Receipt } from "../lib/api";
import { safeUrl } from "../lib/presentation";
import { CopyField } from "./copy-field";
export function ReceiptEntries({ receipt }: { receipt: Receipt }) {
  const entries = [
    ...receipt.acceptedEvidence.map((e) => ({
      ...e,
      accepted: true,
      reasons: [] as string[],
    })),
    ...receipt.rejectedEvidence.map((e) => ({
      ...e,
      accepted: false,
      payoutUnits: "0",
      scores: null,
    })),
  ];
  const [id, setId] = useState(entries[0]?.submissionId ?? "");
  const source = entries.find((e) => e.submissionId === id);
  return (
    <div className="receipt-entries">
      <div>
        <p className="eyebrow">Evidence index / Select an entry</p>
        {entries.map((e, i) => (
          <button
            key={e.submissionId}
            className={`receipt-entry ${id === e.submissionId ? "selected" : ""}`}
            onClick={() => setId(e.submissionId)}
            aria-pressed={id === e.submissionId}
          >
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <span>
              {e.url ?? "URL not recorded"}
              <small>
                {e.accepted ? "Accepted" : "Rejected"} / {fmtUsdc(e.payoutUnits)} USDC
              </small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <article className="receipt-entry-detail">
        {source ? (
          <>
            <span className={`pill ${source.accepted ? "ok" : "bad"}`}>
              {source.accepted ? "Accepted evidence" : "Rejected evidence"}
            </span>
            <h3>
              {source.accepted
                ? "Included in the evidence portfolio."
                : "Retained in the rejection record."}
            </h3>
            <a
              className="source-url"
              href={safeUrl(source.url)}
              target="_blank"
              rel="noreferrer"
            >
              {source.url ?? "URL not recorded"}
            </a>
            <p>
              {source.reasons.join("; ") ||
                "Accepted by the recorded evaluator. This entry preserves its declared metadata and allocation."}
            </p>
            <p className="entry-payout">
              {fmtUsdc(source.payoutUnits)} <small>USDC allocation</small>
            </p>
            {source.scores && (
              <dl className="score-list">
                {Object.entries(source.scores).map(([name, score]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{score.toLocaleString("en-US")} / 1,000,000</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="muted">
              Scores are evaluation scores, not probabilities of factual truth.
            </p>
            <CopyField label="supplier" value={source.supplierAddress} />
            <CopyField label="submission" value={source.submissionId} />
            {source.contentHash && (
              <CopyField label="content hash" value={source.contentHash} />
            )}
          </>
        ) : (
          <p>No source entries recorded.</p>
        )}
      </article>
    </div>
  );
}
