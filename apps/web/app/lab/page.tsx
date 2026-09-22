import { EvidenceLab } from "../../components/evidence-lab";

export default function LabPage() {
  return (
    <main className="container">
      <section className="hero">
        <div className="tagline">
          From an unsupported claim to an inspectable decision
        </div>
        <h2>Follow the evidence. Follow the money.</h2>
        <p className="sub">
          Run a 0.05 USDC bounty through the real verification and settlement engine.
          Inspect what earns a reward, what gets rejected, and when the agent must stop.
        </p>
      </section>
      <EvidenceLab />
    </main>
  );
}
