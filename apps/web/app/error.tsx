"use client";
export default function MarketError() {
  return (
    <main id="main" className="container">
      <section className="hero">
        <p className="eyebrow">Records unavailable / Nothing inferred</p>
        <h1>
          This desk is
          <br />
          <em>temporarily offline.</em>
        </h1>
        <p>
          We could not load current evidence and payment records. Please retry when the
          service is online.
        </p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Retry
        </button>{" "}
        <a className="text-link" href="/verify">
          Verify a downloaded proof offline ↗
        </a>
      </section>
    </main>
  );
}
