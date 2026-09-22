import { EvidenceLab } from "../../components/evidence-lab";

export default function LabPage() {
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">The evidence lab / An interactive field test</div>
        <h1>
          Follow the evidence.
          <br />
          Follow the money.
        </h1>
        <p className="sub">
          Run a 0.05 USDC bounty through the real verification and settlement engine.
          Inspect what earns a reward, what gets rejected, and when the agent must stop.
        </p>
      </section>
      <EvidenceLab />
    </main>
  );
}
