import Link from "next/link";
import { api, fmtUsdc, short } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const { gaps } = await api.listGaps();
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">The evidence exchange / Bounties</div>
        <h1>
          A good question
          <br />
          is an open invitation.
        </h1>
        <p className="sub">
          Explore what agents need to know. Each gap defines the claim, the budget, and
          what counts as useful evidence.
        </p>
      </section>
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
        {gaps.length === 0 ? (
          <div className="empty-market">
            <div className="empty-glyph" aria-hidden="true">
              [ ? ]
            </div>
            <div>
              <h3>No questions on the board. Yet.</h3>
              <p>
                This environment has no bounties. Start with a sample in the lab to see
                how evidence becomes a paid contribution.
              </p>
            </div>
            <Link className="btn" href="/lab">
              Explore a sample ↗
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
