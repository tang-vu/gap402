import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError, fmtUsdc, short, type Receipt } from "../../../lib/api";
import { Lifecycle } from "../../../components/lifecycle";
import { EvidenceGraph } from "../../../components/evidence-graph";
import { SettlementGraph } from "../../../components/settlement-graph";

export const dynamic = "force-dynamic";

export default async function GapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail;
  try {
    detail = await api.gapDetail(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { gap, runtime, submissions, evaluations, plan, explorer } = detail;
  let receipt: Receipt | null = null;
  try {
    receipt = await api.receiptByBounty(id);
  } catch {
    /* none yet */
  }

  const evalBySub = new Map(evaluations.map((e) => [e.submissionId, e]));

  return (
    <main id="main" className="container">
      <section className="block">
        <h3>Gap · {gap.id}</h3>
        <p className="notice">
          {runtime.fundTxHash
            ? "Funding transaction recorded. Follow the transaction links to inspect settlement."
            : "OFFCHAIN SIMULATION — no escrow funding transaction recorded."}
        </p>
        <Lifecycle status={gap.status} />
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="panel">
            <dl className="kv">
              <dt>question</dt>
              <dd>{gap.question}</dd>
              <dt>claim</dt>
              <dd>{gap.claim}</dd>
              <dt>budget</dt>
              <dd className="mono">{fmtUsdc(gap.budgetUnits)} USDC</dd>
              <dt>requester</dt>
              <dd className="mono">{short(gap.requesterAddress)}</dd>
              <dt>verifier</dt>
              <dd className="mono">{short(gap.verifierAddress)}</dd>
              <dt>deadline</dt>
              <dd className="mono">{new Date(gap.deadline).toLocaleString()}</dd>
              <dt>spec hash</dt>
              <dd className="mono">
                {runtime.specHash ? short(runtime.specHash, 12) : "—"}
              </dd>
            </dl>
          </div>
          <div className="panel">
            <h3
              style={{
                marginTop: 0,
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              requirements
            </h3>
            <pre className="json" style={{ maxHeight: 220 }}>
              {JSON.stringify(gap.requirements, null, 2)}
            </pre>
          </div>
        </div>
      </section>

      <section className="block">
        <h3>Evidence graph · {submissions.length} submissions</h3>
        <div className="panel">
          <EvidenceGraph
            claim={gap.claim}
            submissions={submissions}
            evaluations={evaluations}
          />
        </div>
        <table className="market" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>source</th>
              <th>supplier</th>
              <th>verdict</th>
              <th>support</th>
              <th>independence</th>
              <th>freshness</th>
              <th>reasons</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const e = evalBySub.get(s.id);
              return (
                <tr key={s.id}>
                  <td>
                    <a href={s.canonicalUrl} target="_blank" rel="noreferrer">
                      {s.title ?? s.canonicalUrl}
                    </a>
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {short(s.contentHash, 8)}
                    </div>
                  </td>
                  <td className="mono">{short(s.supplierAddress, 6)}</td>
                  <td>
                    {e ? (
                      <span className={`pill ${e.verdict === "accepted" ? "ok" : "bad"}`}>
                        {e.verdict}
                      </span>
                    ) : (
                      <span className="pill warn">pending</span>
                    )}
                  </td>
                  <td className="mono">
                    {e ? `${(e.scores.support / 10000).toFixed(0)}%` : "—"}
                  </td>
                  <td className="mono">
                    {e ? `${(e.scores.independence / 10000).toFixed(0)}%` : "—"}
                  </td>
                  <td className="mono">
                    {e ? `${(e.scores.freshness / 10000).toFixed(0)}%` : "—"}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {e?.rejectReasons.join("; ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {plan ? (
        <section className="block">
          <h3>Settlement · {plan.algorithmVersion}</h3>
          <div className="panel">
            <SettlementGraph plan={plan} />
          </div>
          <table className="market" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>recipient</th>
                <th>submission</th>
                <th>amount</th>
                <th>share</th>
                <th>why</th>
              </tr>
            </thead>
            <tbody>
              {plan.payouts.map((p, i) => (
                <tr key={i}>
                  <td className="mono">{short(p.recipient, 8)}</td>
                  <td className="mono muted">{p.submissionId}</td>
                  <td className="mono">{fmtUsdc(p.amountUnits)} USDC</td>
                  <td className="mono">{(p.shareBps / 100).toFixed(1)}%</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {p.explanation.note ??
                      `quality ${p.explanation.quality}${p.explanation.capped ? " (capped)" : ""}`}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="mono muted">refund</td>
                <td />
                <td className="mono">{fmtUsdc(plan.refundUnits)} USDC</td>
                <td />
                <td className="muted" style={{ fontSize: 12 }}>
                  unallocated residue
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="block">
        <h3>Chain proof</h3>
        <div className="panel">
          <dl className="kv">
            <dt>network</dt>
            <dd className="mono">{runtime.network ?? "—"}</dd>
            <dt>fund tx</dt>
            <dd className="mono">
              {explorer.fundTx ? (
                <a href={explorer.fundTx}>{short(runtime.fundTxHash ?? "", 12)}</a>
              ) : (
                "—"
              )}
            </dd>
            <dt>settlement tx</dt>
            <dd className="mono">
              {explorer.settlementTx ? (
                <a href={explorer.settlementTx}>
                  {short(runtime.settlementTxHash ?? "", 12)}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>settlement hash</dt>
            <dd className="mono">{plan ? short(plan.settlementHash, 12) : "—"}</dd>
            <dt>receipt</dt>
            <dd className="mono">
              {receipt ? <Link href={`/receipts/${receipt.id}`}>{receipt.id}</Link> : "—"}
            </dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
