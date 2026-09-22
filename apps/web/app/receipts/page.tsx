import Link from "next/link";
import { API_BASE, fmtUsdc, type Receipt } from "../../lib/api";
export const dynamic = "force-dynamic";
export default async function ReceiptsPage() {
  const res = await fetch(`${API_BASE}/api/receipts`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Receipt archive unavailable");
  const receipts: Receipt[] = (await res.json()).receipts;
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">The record / Receipt archive</div>
        <h1>
          Decisions leave
          <br />
          <em>a paper trail.</em>
        </h1>
        <p className="sub">
          A portable record of the claim, its evidence and the allocation. Open a receipt
          to trace the decision or export its proof.
        </p>
        <Link className="text-link" href="/verify">
          Already have a proof? Inspect it locally ↗
        </Link>
      </section>
      <section className="receipt-archive" aria-label="Evidence receipts">
        {receipts.map((r, i) => (
          <article className="archive-document" key={r.id}>
            <div className="paper-header">
              <span>EVIDENCE RECEIPT</span>
              <span>{String(i + 1).padStart(3, "0")}</span>
            </div>
            <Link href={`/receipts/${r.id}`}>
              <h2>
                {r.targetClaim} <span aria-hidden="true">↗</span>
              </h2>
            </Link>
            <p>
              {r.acceptedEvidence.length} accepted sources · {r.rejectedEvidence.length}{" "}
              rejected
            </p>
            <div className="archive-amount">
              <span>Total paid / includes verifier fee</span>
              <strong>
                {fmtUsdc(r.totalPaidUnits)} <small>USDC</small>
              </strong>
            </div>
            <p className="mono">
              {r.network} ·{" "}
              {r.settlementTx
                ? "Settlement transaction recorded"
                : "No settlement transaction recorded"}
            </p>
            <code>{r.receiptHash}</code>
            <Link className="text-link" href={`/receipts/${r.id}`}>
              Open receipt →
            </Link>
          </article>
        ))}
      </section>
      {!receipts.length && (
        <div className="empty-market">
          <span className="empty-glyph" aria-hidden="true">
            [ ↳ ]
          </span>
          <div>
            <h3>The archive starts with a settlement.</h3>
            <p>
              No receipts in this environment. Run a simulated bounty in the lab, or
              inspect a proof you already have.
            </p>
          </div>
          <Link className="btn" href="/lab">
            Explore the lab ↗
          </Link>
        </div>
      )}
    </main>
  );
}
