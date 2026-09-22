import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">404 / A different kind of knowledge gap</div>
        <h1>This trail ends here.</h1>
        <p className="sub">
          This page or record could not be found. Return to the market, or explore a
          sample bounty in the lab.
        </p>
      </section>
      <div className="cta-row">
        <Link className="btn primary" href="/gaps">
          Back to the market ↗
        </Link>
        <Link className="text-link" href="/lab">
          Explore the lab →
        </Link>
      </div>
    </main>
  );
}
