"use client";

import { useEffect, useRef, useState } from "react";
import { verifyBundle } from "@gap402/protocol";
import {
  fmtUsdc,
  type Gap,
  type Submission,
  type Evaluation,
  type SettlementPlan,
  type Receipt,
} from "../lib/api";
import { ProofInspector } from "./proof-inspector";

type Run = {
  gap: Gap;
  submissions: Submission[];
  evaluations: Evaluation[];
  plan: SettlementPlan | null;
  receipt: Receipt | null;
  before: string;
  after: string;
  duplicatePrevented: boolean;
  blockedReason: string | null;
};

export function EvidenceLab() {
  const [scenario, setScenario] = useState("mixed");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (run)
      resultRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [run]);
  async function start() {
    setBusy(true);
    setError("");
    setRun(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Demo failed");
      setRun(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel lab-controls">
        <div className="simulation-note">
          <div>
            <strong>Sandbox / No wallet required</strong>
            <p>
              Invented sources. Mock semantic scoring. Real allocation logic. This
              isolated simulation never submits a blockchain transaction.
            </p>
          </div>
          <div className="simulation-spend">
            Actual spend<b>0 USDC</b>
          </div>
        </div>
        <fieldset className="scenario-grid" disabled={busy}>
          <legend>01 / Choose your evidence</legend>
          {(
            [
              [
                "mixed",
                "A useful discovery",
                "Two useful sources, a stale rumor, and a duplicate. See what earns a reward.",
              ],
              [
                "rejected",
                "Nothing holds up",
                "Every source fails. See where the budget goes when the agent must abstain.",
              ],
              [
                "insufficient",
                "Almost enough",
                "Useful sources, but not enough independent domains. Settlement must wait.",
              ],
            ] as const
          ).map(([value, title, description], i) => (
            <label className="scenario-choice" key={value}>
              <input
                type="radio"
                name="scenario"
                value={value}
                checked={scenario === value}
                onChange={() => {
                  setScenario(value);
                  setRun(null);
                  setError("");
                }}
              />
              <span className="scenario-number">CASE / 0{i + 1}</span>
              <strong>{title}</strong>
              <small>{description}</small>
            </label>
          ))}
        </fieldset>
        <div className="lab-action">
          <button className="btn primary" onClick={start} disabled={busy}>
            {busy ? "Evaluating evidence…" : "Run this experiment"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
          <p role="status" aria-live="polite">
            {busy
              ? "Checking sources and calculating the portfolio…"
              : error || "0.05 USDC simulated budget · No actual spend"}
          </p>
        </div>
      </section>
      {!run && !busy && !error && (
        <div className="lab-intro">
          <span aria-hidden="true">↳</span>
          <h3>What does good evidence earn?</h3>
          <p>
            Pick a case and run the experiment. Follow each source from acceptance checks
            to allocation, then inspect the final proof yourself.
          </p>
        </div>
      )}
      {run && (
        <div>
          <div className="run-summary" ref={resultRef} role="status">
            <p>
              <strong>Experiment complete.</strong>{" "}
              {run.blockedReason
                ? "The source requirement stopped settlement."
                : "Every unit accounted for. The proof is ready to inspect."}
            </p>
            <span className="mono">SIMULATION / 0 USDC SPENT</span>
          </div>
          <section className="block lab-grid">
            <article className="panel">
              <div className="tagline">01 · Detect</div>
              <h3>{run.gap.claim}</h3>
              <p>{run.before}</p>
              <p>Requirement: sources published within 30 days; support score ≥ 60%.</p>
            </article>
            <article className="panel">
              <div className="tagline">02 · Commission</div>
              <h3>{fmtUsdc(run.gap.budgetUnits)} USDC</h3>
              <p>
                Simulated budget reserved. Fixed acceptance criteria precede supplier
                submissions.
              </p>
              <p>
                {run.duplicatePrevented
                  ? "Tracking-link duplicate prevented: no second submission or reward."
                  : "No duplicate submitted in this scenario."}
              </p>
            </article>
          </section>
          <section className="block">
            <h3>03 · Verify each submission</h3>
            <div className="lab-grid">
              {run.submissions.map((s) => {
                const evaluation = run.evaluations.find((e) => e.submissionId === s.id);
                return (
                  <article className="panel" key={s.id}>
                    <span
                      className={`status ${evaluation?.verdict === "accepted" ? "settled" : "expired"}`}
                    >
                      {evaluation?.verdict}
                    </span>
                    <h4>{s.title}</h4>
                    <p className="mono muted">
                      {new URL(s.canonicalUrl).hostname} · fixture
                    </p>
                    <p>
                      {evaluation?.rejectReasons.join("; ") ||
                        "Passed the declared checks and mock semantic threshold."}
                    </p>
                    <details>
                      <summary>Inspect verification checks</summary>
                      {evaluation?.checks.map((c, i) => (
                        <p key={i}>
                          {c.passed ? "✓" : "×"} {c.name}: {c.detail}
                        </p>
                      ))}
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="block">
            <h3>04 · Settle or refuse</h3>
            {run.plan ? (
              <div className="panel">
                <table className="market payout-table">
                  <thead>
                    <tr>
                      <th>Recipient / role</th>
                      <th>Simulated payout</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.plan.payouts.map((p) => (
                      <tr key={p.submissionId}>
                        <td className="mono" data-label="Recipient">
                          {p.submissionId === "verifier-fee"
                            ? "Verifier"
                            : `${p.recipient.slice(0, 10)}…`}
                        </td>
                        <td data-label="Simulated payout">
                          {fmtUsdc(p.amountUnits)} USDC
                        </td>
                        <td data-label="Reason">
                          {p.explanation.note ??
                            `Quality ${p.explanation.quality}; ${p.explanation.capped ? "share capped" : "proportional share"}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Refund: {fmtUsdc(run.plan.refundUnits)} USDC · Paid + refund ={" "}
                  {fmtUsdc(run.gap.budgetUnits)} USDC
                </p>
              </div>
            ) : (
              <p className="panel notice">
                {run.blockedReason}. No settlement plan or receipt issued.
              </p>
            )}
          </section>
          <section className="block">
            <h3>05 · Resume with evidence, or abstain</h3>
            <p className="panel">{run.after}</p>
          </section>
          {run.receipt && (
            <ProofInspector
              initialBundle={{ gap: run.gap, plan: run.plan, receipt: run.receipt }}
            />
          )}
          {run.receipt && !verifyBundle(run).valid && (
            <p role="alert">Integrity failure: do not consume this result.</p>
          )}
        </div>
      )}
    </>
  );
}
