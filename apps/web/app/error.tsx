"use client";
export default function MarketError({ reset }: { reset: () => void }) {
  return (
    <main className="container">
      <section className="block panel">
        <h2>The market is temporarily unavailable</h2>
        <p>
          We could not load current evidence and payment records. Please retry when the
          service is online.
        </p>
        <button className="btn" onClick={reset}>
          Retry
        </button>{" "}
        <a href="/verify">Verify a downloaded proof offline</a>
      </section>
    </main>
  );
}
