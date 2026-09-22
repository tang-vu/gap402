import { ProofInspector } from "../../components/proof-inspector";
export default function VerifyPage() {
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">The proof desk / Local verification</div>
        <h1>
          Trust the process.
          <br />
          Check the receipt.
        </h1>
        <p className="sub">
          Open a proof bundle to trace the original request, the allocation, and the
          receipt. Your file stays in your browser.
        </p>
      </section>
      <ProofInspector />
    </main>
  );
}
