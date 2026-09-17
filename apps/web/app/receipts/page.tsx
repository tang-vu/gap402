import Link from "next/link";
import { API_BASE, fmtUsdc, short, type Receipt } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const res = await fetch(`${API_BASE}/api/receipts`, { cache: "no-store" });
  const receipts: Receipt[] = res.ok ? (await res.json()).receipts : [];
  return (
    <main className="container">
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
          <p className="muted">No receipts yet — settle a gap first.</p>
        ) : null}
      </section>
    </main>
  );
}
