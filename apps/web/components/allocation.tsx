"use client";
import { useState } from "react";
import { fmtUsdc, type SettlementPlan, type Submission } from "../lib/api";
import { accounting, ratio } from "../lib/presentation";
export function Allocation({
  plan,
  budget,
  submissions = [],
  selected,
  onSelect,
}: {
  plan: SettlementPlan;
  budget?: string;
  submissions?: Submission[];
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const [local, setLocal] = useState("");
  const active = selected ?? local;
  const totals = accounting(plan, budget);
  const payout = plan.payouts.find((p) => p.submissionId === active);
  const rows = [
    ...plan.payouts.map((p) => ({
      id: p.submissionId,
      amount: p.amountUnits,
      label:
        p.submissionId === "verifier-fee"
          ? "Verifier fee"
          : `Source ${String(submissions.findIndex((s) => s.id === p.submissionId) + 1).padStart(2, "0")}`,
      recipient: p.recipient,
    })),
    {
      id: "refund",
      amount: plan.refundUnits,
      label: "Requester refund",
      recipient: "Returned to requester",
    },
  ];
  function select(id: string) {
    setLocal(id);
    onSelect?.(id);
  }
  return (
    <section className="allocation" aria-label="Exact budget allocation">
      <div className="allocation-total">
        <p className="eyebrow">Budget / USDC</p>
        <strong>{fmtUsdc(totals.total)}</strong>
        <span className={totals.reconciled ? "pill ok" : "pill bad"}>
          {totals.reconciled ? "Exact reconciliation" : "Accounting mismatch"}
        </span>
      </div>
      <div className="allocation-body">
        <div className="allocation-bar" aria-hidden="true">
          {rows.map((r, i) => (
            <span
              key={r.id}
              className={`segment segment-${i % 4}`}
              style={{ width: `${ratio(r.amount, totals.total.toString())}%` }}
            />
          ))}
        </div>
        <div className="allocation-rows">
          {rows.map((r, i) => (
            <button
              className={`allocation-row ${active === r.id ? "selected" : ""}`}
              aria-pressed={active === r.id}
              onClick={() => select(r.id)}
              key={r.id}
            >
              <span>
                <i className={`swatch segment-${i % 4}`} />
                {r.label}
              </span>
              <strong>
                {fmtUsdc(r.amount)} <small>USDC</small>
              </strong>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <p className="reconciliation mono">
          {fmtUsdc(totals.suppliers)} suppliers + {fmtUsdc(totals.fee)} fee +{" "}
          {fmtUsdc(totals.refund)} refund = {fmtUsdc(totals.total)} USDC
        </p>
        <div className="allocation-explanation" aria-live="polite">
          {payout ? (
            <>
              <p className="eyebrow">Why this allocation?</p>
              <p>{payout.explanation.note ?? "Quality-weighted portfolio allocation."}</p>
              <dl className="kv">
                <dt>Quality score</dt>
                <dd>{payout.explanation.quality} / 1,000,000</dd>
                <dt>Share</dt>
                <dd>{payout.explanation.shareBps} basis points</dd>
                <dt>Share capped</dt>
                <dd>{payout.explanation.capped ? "Yes" : "No"}</dd>
                <dt>Below floor</dt>
                <dd>{payout.explanation.belowMinPayout ? "Yes" : "No"}</dd>
                <dt>Recipient</dt>
                <dd className="mono">{payout.recipient}</dd>
              </dl>
            </>
          ) : active === "refund" ? (
            <p>
              Unallocated budget returned to the requester: {fmtUsdc(plan.refundUnits)}{" "}
              USDC.
            </p>
          ) : (
            <p>Select a payment to inspect the allocator’s actual explanation.</p>
          )}
        </div>
      </div>
    </section>
  );
}
