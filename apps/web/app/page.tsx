import Link from "next/link";
import { api } from "../lib/api";
import { DossierScene } from "../components/dossier-scene";
import { EvidenceStory } from "../components/evidence-story";
import { MarketRegister } from "../components/market-register";
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
      <section className="exchange-cover">
        <div className="cover-copy">
          <p className="eyebrow">
            <span className="tiny-cross">+</span> The evidence exchange
          </p>
          <h1>
            When evidence
            <br />
            is missing,
            <br />
            <em>
              create a market
              <br />
              for it.
            </em>
          </h1>
          <p className="cover-description">
            Turn an unsupported agent claim into an evidence bounty. Inspect the sources.
            Reward useful contributions. Take the receipt with you.
          </p>
          <div className="cta-row">
            <Link className="btn primary" href="/lab">
              Explore the evidence lab <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="/gaps">
              Browse open gaps →
            </Link>
            <Link className="text-link" href="/mainnet">
              Inspect the Arc mainnet run →
            </Link>
          </div>
          <p className="cover-footnote">01 / Declare the gap. Let evidence close it.</p>
        </div>
        <DossierScene />
      </section>
      <div className="exchange-strip">
        <span>Claim → Evidence → Allocation → Receipt</span>
        <span>USDC accounting / Six decimal places / Every unit traceable</span>
      </div>
      <EvidenceStory />
      <section className="market-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The market / Actual environment records</p>
            <h2>Questions worth answering.</h2>
          </div>
          <Link className="text-link" href="/gaps">
            Open register ↗
          </Link>
        </div>
        {apiDown ? (
          <div className="empty-market">
            <span className="empty-glyph" aria-hidden="true">
              [ — ]
            </span>
            <div>
              <h3>The market is unavailable.</h3>
              <p>
                We could not reach the API. No source activity is inferred. You can still
                inspect a local proof.
              </p>
            </div>
            <Link href="/verify" className="btn">
              Open the proof desk ↗
            </Link>
          </div>
        ) : (
          <MarketRegister gaps={open.slice(0, 5)} compact />
        )}
      </section>
      <section className="manifesto">
        <div>
          <p className="eyebrow">Built for the moment an agent says</p>
          <h2>
            “I don’t know.
            <br />
            <em>Yet.”</em>
          </h2>
        </div>
        <div className="manifesto-copy">
          <p>A missing answer should start a search, not a hallucination.</p>
          <p className="muted">
            Declared requirements, recorded checks and deterministic allocation make the
            decision inspectable. Receipts establish integrity and accounting; they do not
            establish source truth.
          </p>
          <Link className="text-link" href="/verify">
            Inspect a portable proof ↗
          </Link>
          <small>
            x402 per-call evidence pricing is roadmap material. Today’s product uses
            evidence bounties.
          </small>
        </div>
      </section>
    </main>
  );
}
