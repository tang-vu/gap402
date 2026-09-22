import Link from "next/link";
import { api, fmtUsdc } from "../lib/api";
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
    <main id="main" className="container">
      <section className="cover">
        <div className="cover-copy">
          <p className="eyebrow">
            <span className="tiny-cross">+</span> A market for missing knowledge
          </p>
          <h1>
            Good questions.
            <br />
            Missing proof.
            <br />
            <em>Put a bounty on it.</em>
          </h1>
          <p className="cover-description">
            Your agent reached the edge of what it knows. Commission the evidence, reward
            useful sources in USDC, and move forward with a receipt.
          </p>
          <div className="cta-row">
            <Link className="btn primary" href="/lab">
              See a bounty unfold <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="/gaps">
              Explore the market <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="cover-footnote">
            <span className="orbit-mark" aria-hidden="true">
              ◎
            </span>{" "}
            Settlements on Arc <span className="divider">/</span> Denominated in USDC
          </div>
        </div>
        <div
          className="dossier"
          aria-label="Illustrated evidence lifecycle, not live market data"
        >
          <div className="dossier-top">
            <span>FIELD NOTES / 001</span>
            <span>ILLUSTRATIVE</span>
          </div>
          <div className="dossier-question">
            <span className="eyebrow">An unresolved claim</span>
            <h2>
              “Is there enough
              <br />
              evidence to proceed?”
            </h2>
            <span className="pencil-line" />
          </div>
          <div className="evidence-map" aria-hidden="true">
            <svg viewBox="0 0 400 190" fill="none">
              <path
                d="M200 0V35M200 35H62V91M200 35V91M200 35H338V91M62 122V155H200M200 122V190M338 122V155H200"
                stroke="currentColor"
                strokeDasharray="3 5"
              />
              <circle cx="200" cy="35" r="4" fill="currentColor" />
            </svg>
            <div className="source-note">
              <span>01</span>
              <strong>
                Primary
                <br />
                source
              </strong>
              <i>Accepted ↗</i>
            </div>
            <div className="source-note">
              <span>02</span>
              <strong>
                Independent
                <br />
                report
              </strong>
              <i>Accepted ↗</i>
            </div>
            <div className="source-note rejected">
              <span>03</span>
              <strong>
                Outdated
                <br />
                claim
              </strong>
              <i>Rejected ×</i>
            </div>
          </div>
          <div className="receipt-slip">
            <div>
              <span className="eyebrow">The result</span>
              <strong>Evidence you can inspect.</strong>
            </div>
            <span className="receipt-seal" aria-hidden="true">
              ↳
            </span>
          </div>
          <div className="dossier-bottom">
            <span>REQUEST → VERIFY → SETTLE</span>
            <span>G / 402</span>
          </div>
        </div>
      </section>
      <section className="principle-strip" aria-label="Core principles">
        <span>
          <b>01</b> Define what counts.
        </span>
        <span>
          <b>02</b> Pay for useful evidence.
        </span>
        <span>
          <b>03</b> Keep the decision inspectable.
        </span>
      </section>
      <section className="market-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The evidence exchange</p>
            <h2>Questions worth answering.</h2>
          </div>
          <Link className="text-link" href="/gaps">
            All gaps <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {open.length ? (
          <div className="table-scroll">
            <table className="market">
              <thead>
                <tr>
                  <th>Open claim</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                {open.slice(0, 5).map((g) => (
                  <tr key={g.gap.id}>
                    <td>
                      <Link href={`/gaps/${g.gap.id}`}>{g.gap.claim}</Link>
                    </td>
                    <td className="mono">{fmtUsdc(g.gap.budgetUnits)} USDC</td>
                    <td>
                      <span className={`status ${g.gap.status}`}>{g.gap.status}</span>
                    </td>
                    <td className="mono">{g.submissionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-market">
            <div className="empty-glyph" aria-hidden="true">
              [ ? ]
            </div>
            <div>
              <h3>
                {apiDown
                  ? "The market is taking a moment."
                  : "The next question is still unwritten."}
              </h3>
              <p>
                {apiDown
                  ? "We couldn’t reach the market. You can still inspect a proof offline."
                  : "No open bounties in this environment. Follow a sample question through the lab to see how it works."}
              </p>
            </div>
            <Link href={apiDown ? "/verify" : "/lab"} className="btn">
              {apiDown ? "Verify a proof" : "Try a sample bounty"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </section>
      <section className="manifesto">
        <div>
          <p className="eyebrow">Built for the moment an agent says</p>
          <h2>
            “I don’t know.
            <br />
            <em>Yet.</em>”
          </h2>
        </div>
        <div className="manifesto-copy">
          <p>A missing answer should start a search, not a hallucination.</p>
          <p className="muted">
            Gap402 turns an unsupported claim into a precise request. Suppliers contribute
            evidence. Declared checks determine what qualifies. A deterministic allocation
            accounts for every unit of USDC.
          </p>
          <Link className="text-link" href="/verify">
            Inspect the proof, not just the promise <span aria-hidden="true">↗</span>
          </Link>
          <small>
            Receipts prove integrity and accounting. They do not, on their own, prove a
            claim is true.
          </small>
        </div>
      </section>
    </main>
  );
}
