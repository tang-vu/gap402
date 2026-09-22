export default function Loading() {
  return (
    <main id="main" className="container" aria-busy="true">
      <section className="hero">
        <div className="tagline" role="status">
          Opening the evidence desk…
        </div>
        <div className="loading-line" />
        <div className="loading-line short" />
      </section>
      <div className="loading-board" aria-hidden="true" />
    </main>
  );
}
