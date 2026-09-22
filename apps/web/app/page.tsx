import Link from "next/link";
import { api, fmtUsdc, short } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let gaps: Awaited<ReturnType<typeof api.listGaps>>["gaps"] = [];
  let apiDown = false;
  try {
    gaps = (await api.listGaps()).gaps;
  } catch {
    apiDown = true;
  }
  const open = gaps.filter((g) =>
    ["open", "funded", "submissions", "verified"].includes(g.gap.status),
  );

  return (
    <main className="container">
      <section className="hero">
        <div className="tagline">gap402 turns uncertainty into a market</div>
        <h2>The missing-knowledge market for AI agents</h2>
        <p className="sub">
          When an AI agent cannot find enough evidence, Gap402 lets it commission the
          missing proof — acceptance criteria, USDC escrow on Arc, competitive suppliers,
          deterministic settlement, and a cryptographic receipt anyone can verify.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/lab">
            Try the evidence lab
          </Link>
          <Link className="btn primary" href="/gaps">
            View open gaps
          </Link>
          <Link className="btn" href="/receipts">
            Receipt explorer
          </Link>
        </div>
      </section>

      <section className="block">
        <h3>Live market — open evidence gaps</h3>
        {apiDown ? (
          <div className="panel muted">
            API unreachable at {process.env.GAP402_API ?? "http://127.0.0.1:4020"}. Start
            it with <span className="mono">pnpm --filter @gap402/api start</span>, or run
            the full local demo with <span className="mono">pnpm demo</span>.
          </div>
        ) : open.length === 0 ? (
          <div className="panel muted">
            No open gaps. Create one via the CLI (
            <span className="mono">gap402 gap create</span>), the SDK, or{" "}
            <span className="mono">pnpm demo</span>.
          </div>
        ) : (
          <table className="market">
            <thead>
              <tr>
                <th>claim</th>
                <th>reward</th>
                <th>status</th>
                <th>submissions</th>
                <th>deadline</th>
              </tr>
            </thead>
            <tbody>
              {open.map((g) => (
                <tr key={g.gap.id}>
                  <td>
                    <Link href={`/gaps/${g.gap.id}`}>{g.gap.claim}</Link>
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {short(g.gap.id, 8)}
                    </div>
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
        )}
      </section>

      <section className="block">
        <h3>All gaps</h3>
        <table className="market">
          <tbody>
            {gaps.map((g) => (
              <tr key={g.gap.id}>
                <td className="mono muted">{short(g.gap.id, 6)}</td>
                <td>
                  <Link href={`/gaps/${g.gap.id}`}>{g.gap.claim}</Link>
                </td>
                <td className="mono">{fmtUsdc(g.gap.budgetUnits)}</td>
                <td>
                  <span className={`status ${g.gap.status}`}>{g.gap.status}</span>
                </td>
              </tr>
            ))}
            {gaps.length === 0 && !apiDown ? (
              <tr>
                <td className="muted">empty</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
