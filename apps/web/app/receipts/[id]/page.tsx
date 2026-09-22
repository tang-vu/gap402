import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError, fmtUsdc } from "../../../lib/api";
import { ProofInspector } from "../../../components/proof-inspector";
import { CopyField } from "../../../components/copy-field";
import { ReceiptEntries } from "../../../components/receipt-entries";
export const dynamic = "force-dynamic";
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let receipt;
  try {
    receipt = await api.receipt(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const suppliers = receipt.acceptedEvidence.reduce(
    (sum, e) => sum + BigInt(e.payoutUnits),
    0n,
  );
  let bundle: unknown;
  try {
    bundle = await api.proof(receipt.bountyId);
  } catch {}
  const explorer =
    receipt.network === "mainnet"
      ? "https://explorer.arc.io"
      : receipt.network === "testnet"
        ? "https://explorer.testnet.arc.io"
        : null;
  return (
    <main id="main" className="container">
      <div className="receipt-toolbar">
        <Link className="text-link" href="/receipts">
          ← Receipt archive
        </Link>
        <Link className="btn" href={`/gaps/${receipt.bountyId}`}>
          Return to bounty ↗
        </Link>
        {Boolean(bundle) && (
          <a className="btn primary" href="#portable-proof">
            Export / inspect proof ↓
          </a>
        )}
      </div>
      <article className="receipt-document">
        <header className="receipt-document-header">
          <div>
            <p className="eyebrow">Gap402 / The evidence exchange</p>
            <h1>
              Evidence Receipt<span aria-hidden="true">↳</span>
            </h1>
          </div>
          <p className="mono">
            {receipt.network.toUpperCase()}
            <br />
            CHAIN {receipt.chainId}
            <br />
            {receipt.createdAt}
          </p>
        </header>
        <div className="receipt-claim">
          <p className="eyebrow">The recorded claim</p>
          <h2>{receipt.targetClaim}</h2>
          <p className="runtime-note">
            {receipt.settlementTx
              ? "Settlement transaction recorded; independently inspect the registry anchor."
              : "No settlement transaction recorded. This receipt does not establish an onchain anchor."}
          </p>
        </div>
        <section className="receipt-accounting" aria-label="Receipt accounting">
          <div>
            <span>Supplier allocations</span>
            <strong>{fmtUsdc(suppliers)}</strong>
          </div>
          <div>
            <span>Verifier fee</span>
            <strong>{fmtUsdc(receipt.verifierFeeUnits)}</strong>
          </div>
          <div>
            <span>Requester refund</span>
            <strong>{fmtUsdc(receipt.refundUnits)}</strong>
          </div>
          <div className="accounting-sum">
            <span>Total accounted / USDC</span>
            <strong>
              {fmtUsdc(BigInt(receipt.totalPaidUnits) + BigInt(receipt.refundUnits))}
            </strong>
          </div>
        </section>
        <p className="muted">
          Total paid includes the verifier fee once. Refund is separate. These recorded
          amounts do not themselves prove that funds moved.
        </p>
        <ReceiptEntries receipt={receipt} />
        <section className="receipt-identifiers">
          <h2>Portable by design.</h2>
          <p>
            The request, allocation and receipt each have a canonical hash. Compare them
            with the original records and the registry on the stated network.
          </p>
          <CopyField label="receipt identifier" value={receipt.id} />
          <CopyField label="receipt hash" value={receipt.receiptHash} />
          <CopyField label="settlement hash" value={receipt.settlementHash} />
          <CopyField label="request hash" value={receipt.requestHash} />
          <CopyField label="contract" value={receipt.bountyContract} />
          {receipt.settlementTx && (
            <>
              <CopyField label="settlement transaction" value={receipt.settlementTx} />
              {explorer && (
                <a
                  className="text-link"
                  href={`${explorer}/tx/${receipt.settlementTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Inspect recorded transaction ↗
                </a>
              )}
            </>
          )}
          <p>
            Evaluator: <span className="mono">{receipt.evaluatorVersion}</span>
          </p>
          <details>
            <summary>Advanced / original receipt JSON</summary>
            <pre className="json">{JSON.stringify(receipt, null, 2)}</pre>
          </details>
        </section>
      </article>
      <div id="portable-proof">
        {bundle ? (
          <ProofInspector initialBundle={bundle} />
        ) : (
          <div className="refusal">
            <h3>Full proof bundle unavailable.</h3>
            <p>
              The stored plan could not be retrieved. The receipt above remains readable;
              local bundle verification requires the original gap, plan and receipt.
            </p>
            <Link href="/verify" className="btn">
              Open your own proof
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
