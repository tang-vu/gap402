import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError, fmtUsdc, type Receipt } from "../../../lib/api";
import { Lifecycle } from "../../../components/lifecycle";
import { Requirements } from "../../../components/requirements";
import { EvidenceWorkspace } from "../../../components/evidence-workspace";
import { CopyField } from "../../../components/copy-field";
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
  let receiptUnavailable = false;
  try {
    receipt = await api.receiptByBounty(id);
  } catch (e) {
    receiptUnavailable = !(e instanceof ApiError && e.status === 404);
  }
  return (
    <main id="main" className="container">
      <section className="hero investigation-hero">
        <Link className="text-link" href="/gaps">
          ← Market register
        </Link>
        <p className="eyebrow">Investigation dossier / {gap.id}</p>
        <h1>{gap.claim}</h1>
        <p className="sub">{gap.question}</p>
        <div className="dossier-facts">
          <div>
            <span>Budget / USDC</span>
            <strong>{fmtUsdc(gap.budgetUnits)}</strong>
          </div>
          <div>
            <span>Lifecycle</span>
            <strong>{gap.status}</strong>
          </div>
          <div>
            <span>Deadline / UTC</span>
            <strong className="date-value">{gap.deadline}</strong>
          </div>
          <div>
            <span>Recorded network</span>
            <strong>{runtime.network ?? "Unknown"}</strong>
          </div>
        </div>
      </section>
      <div className="runtime-note">
        <p>
          {runtime.fundTxHash
            ? "Funding transaction recorded."
            : "No funding transaction recorded. Escrow is not established by this lifecycle state."}{" "}
          {runtime.settlementTxHash
            ? "Settlement transaction recorded; inspect its registry anchor independently."
            : "No settlement transaction recorded."}
        </p>
        <div className="cta-row">
          {runtime.fundTxHash && explorer.fundTx && (
            <a
              className="text-link"
              href={explorer.fundTx}
              target="_blank"
              rel="noreferrer"
            >
              Funding transaction ↗
            </a>
          )}
          {runtime.settlementTxHash && explorer.settlementTx && (
            <a
              className="text-link"
              href={explorer.settlementTx}
              target="_blank"
              rel="noreferrer"
            >
              Settlement transaction ↗
            </a>
          )}
          {receipt && (
            <Link className="btn" href={`/receipts/${receipt.id}`}>
              Open Evidence Receipt ↗
            </Link>
          )}
        </div>
      </div>
      <Lifecycle status={gap.status} />
      <p className="muted">
        Lifecycle describes the recorded application state, not proof of earlier chain
        transactions.
      </p>
      <div className="investigation-layout">
        <aside className="investigation-rules">
          <Requirements requirements={gap.requirements} />
          <details>
            <summary>Requester, verifier & request identity</summary>
            <CopyField label="requester" value={gap.requesterAddress} />
            <CopyField label="verifier" value={gap.verifierAddress} />
            {runtime.specHash && (
              <CopyField label="specification hash" value={runtime.specHash} />
            )}
            <p>Created: {gap.createdAt}</p>
            {runtime.fundTxHash && (
              <CopyField label="funding transaction" value={runtime.fundTxHash} />
            )}{" "}
            {runtime.settlementTxHash && (
              <CopyField
                label="settlement transaction"
                value={runtime.settlementTxHash}
              />
            )}
          </details>
        </aside>
        <div>
          <EvidenceWorkspace
            submissions={submissions}
            evaluations={evaluations}
            plan={plan}
            receipt={receiptUnavailable ? undefined : receipt}
          />
          {!plan && (
            <div className="refusal">
              <h3>No allocation recorded.</h3>
              <p>
                Inspect source checks and the declared requirements before attempting
                settlement. No payout or refund is inferred.
              </p>
            </div>
          )}
          {receiptUnavailable && (
            <p role="status">
              The receipt service is unavailable; receipt inclusion cannot currently be
              established.
            </p>
          )}
          {plan && (
            <details>
              <summary>Advanced / original settlement plan</summary>
              <pre className="json">{JSON.stringify(plan, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
