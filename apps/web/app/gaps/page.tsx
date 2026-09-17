import Link from "next/link";
import { api, fmtUsdc, short } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const { gaps } = await api.listGaps();
  return (
    <main className="container">
      <section className="block">
        <h3>Evidence gaps</h3>
        <table className="market">
          <thead>
            <tr>
              <th>id</th>
              <th>claim</th>
              <th>reward</th>
              <th>status</th>
              <th>subs</th>
              <th>deadline</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.gap.id}>
                <td className="mono muted">{short(g.gap.id, 6)}</td>
                <td>
                  <Link href={`/gaps/${g.gap.id}`}>{g.gap.claim}</Link>
                </td>
                <td className="mono">{fmtUsdc(g.gap.budgetUnits)} USDC</td>
                <td>
                  <span className={`status ${g.gap.status}`}>{g.gap.status}</span>
                </td>
                <td className="mono">{g.submissionCount}</td>
                <td className="mono muted">
                  {new Date(g.gap.deadline).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {gaps.length === 0 ? <p className="muted">No gaps yet.</p> : null}
      </section>
    </main>
  );
}
