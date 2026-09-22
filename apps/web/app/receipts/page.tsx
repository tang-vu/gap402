import Link from "next/link";
import { API_BASE, fmtUsdc, short, type Receipt } from "../../lib/api";

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
        <div className="tagline">The record / Evidence receipts</div>
        <h1>
          Every decision
          <br />
          leaves a paper trail.
        </h1>
        <p className="sub">
          Inspect accepted evidence, supplier payouts, and settlement records. Each
          receipt connects a question to the evidence that answered it.
        </p>
      </section>
      <section className="block">
        <h3>Evidence receipts</h3>
        <table className="market">
          <thead>
            <tr>
              <th>receipt</th>
              <th>claim</th>
              <th>accepted</th>
              <th>paid</th>
              <th>hash</th>
              <th>network</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/receipts/${r.id}`} className="mono">
                    {short(r.id, 8)}
                  </Link>
                </td>
                <td>{r.targetClaim}</td>
                <td className="mono">{r.acceptedEvidence.length}</td>
                <td className="mono">{fmtUsdc(r.totalPaidUnits)} USDC</td>
                <td className="mono muted">{short(r.receiptHash, 10)}</td>
                <td className="mono muted">{r.network}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {receipts.length === 0 ? (
          <div className="empty-market">
            <div className="empty-glyph" aria-hidden="true">
              [ ↳ ]
            </div>
            <div>
              <h3>The archive starts with a settlement.</h3>
              <p>
                No receipts have been issued in this environment. Run a simulated bounty
                to inspect an example, or open a proof you already have.
              </p>
            </div>
            <Link className="btn" href="/verify">
              Open a proof ↗
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
