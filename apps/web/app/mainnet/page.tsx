import Link from "next/link";
import proof from "../../public/mainnet-proof.json";

const deployment = "0xadaec572036fce9b6c7b4a1e4aa979ac57c5d183";
const registry = "0x89dec1F5223d8BB64a39643790115e553C24fF65";
const deployTx = "0x881fccde46362bc2b72f192ddcd4a787fac0da8e9cada664ed59ec6d98bf11a1";
const fundTx = "0xddca31454992b56dd8ac935ae6ee54e83712ef3ce92db25408880f842078c664";
const settleTx = proof.receipt.settlementTx;
const explorer = "https://explorer.arc.io";

function usdc(units: string): string {
  const amount = BigInt(units);
  return `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, "0")}`;
}

export default function MainnetPage() {
  const { gap, plan, receipt } = proof;
  const supplierPayout = plan.payouts
    .filter((payout) => payout.submissionId !== "verifier-fee")
    .reduce((total, payout) => total + BigInt(payout.amountUnits), 0n);

  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="tagline">Arc mainnet / Settled 24 September 2026</div>
        <h1>
          A real bounty.
          <br />A portable receipt.
        </h1>
        <p className="sub">
          Gap402 escrowed 0.05 USDC on Arc, evaluated two fetched sources, paid a supplier
          wallet, and anchored the receipt hash onchain. This is a recorded mainnet run;
          the public Evidence Lab remains a zero-spend sandbox.
        </p>
        <div className="cta-row">
          <a className="btn primary" href="/mainnet-proof.json" download>
            Download the proof ↗
          </a>
          <a className="text-link" href={`${explorer}/tx/${settleTx}`}>
            Inspect settlement on Arc ↗
          </a>
        </div>
      </section>

      <section className="block">
        <h3>01 / The claim</h3>
        <div className="panel">
          <h2>{gap.claim}</h2>
          <p className="muted">
            The autonomous buyer started without supporting evidence and opened bounty{" "}
            <code>{gap.id}</code>. Both sources were fetched from public pages.
          </p>
          <p>
            <strong>Judgment method:</strong> deterministic checks plus the clearly
            labelled mock semantic scorer. This run demonstrates settlement and receipt
            integrity; it does not authenticate publishers or establish the factual truth
            of arbitrary claims.
          </p>
        </div>
      </section>

      <section className="block">
        <h3>02 / USDC accounting</h3>
        <div className="receipt-accounting">
          <div>
            <span>Escrowed</span>
            <strong>{usdc(gap.budgetUnits)}</strong>
          </div>
          <div>
            <span>Supplier payout</span>
            <strong>{usdc(supplierPayout.toString())}</strong>
          </div>
          <div>
            <span>Verifier fee</span>
            <strong>{usdc(plan.verifierFeeUnits)}</strong>
          </div>
          <div className="accounting-sum">
            <span>Refunded</span>
            <strong>{usdc(plan.refundUnits)}</strong>
          </div>
        </div>
        <p className="muted">
          Amounts above are USDC. The supplier and verifier wallets are both controlled by
          this prototype&apos;s operator; the run is a payment flow demonstration, not
          evidence of external marketplace activity.
        </p>
      </section>

      <section className="block">
        <h3>03 / Evidence in the receipt</h3>
        <div className="panel">
          {receipt.acceptedEvidence.map((entry, index) => (
            <p key={entry.submissionId}>
              <span className="mono">0{index + 1} / </span>
              <a className="text-link" href={entry.url}>
                {new URL(entry.url).hostname} ↗
              </a>
              <br />
              <small>
                Content hash <code>{entry.contentHash}</code>
              </small>
            </p>
          ))}
          <p className="muted">
            Source types were left unclassified. Both accepted submissions share one
            payout wallet, so the allocator aggregates their payment.
          </p>
        </div>
      </section>

      <section className="block">
        <h3>04 / Verify independently</h3>
        <div className="panel">
          <p>
            <strong>GapBounty:</strong>{" "}
            <a className="text-link mono" href={`${explorer}/address/${deployment}`}>
              {deployment} ↗
            </a>
          </p>
          <p>
            <strong>Receipt registry:</strong>{" "}
            <a className="text-link mono" href={`${explorer}/address/${registry}`}>
              {registry} ↗
            </a>
          </p>
          <p>
            <strong>Deployment:</strong>{" "}
            <a className="text-link mono" href={`${explorer}/tx/${deployTx}`}>
              {deployTx} ↗
            </a>
          </p>
          <p>
            <strong>Funding:</strong>{" "}
            <a className="text-link mono" href={`${explorer}/tx/${fundTx}`}>
              {fundTx} ↗
            </a>
          </p>
          <p>
            <strong>Settlement:</strong>{" "}
            <a className="text-link mono" href={`${explorer}/tx/${settleTx}`}>
              {settleTx} ↗
            </a>
          </p>
          <p>
            <strong>Receipt hash:</strong> <code>{receipt.receiptHash}</code>
          </p>
          <p className="muted">
            The registry returned <code>isAnchored(receiptHash) = true</code> on Arc
            mainnet. The downloaded bundle also passes the offline CLI integrity checks.
            Browser verification checks the bundle locally; compare the hash to the
            registry separately for chain anchoring.
          </p>
          <div className="cta-row">
            <Link className="btn" href="/verify">
              Open the proof desk ↗
            </Link>
            <a className="text-link" href="/mainnet-proof.json" download>
              Download JSON proof ↗
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
