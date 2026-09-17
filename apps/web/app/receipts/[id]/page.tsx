import Link from "next/link";
import { notFound } from "next/navigation";
import { api, fmtUsdc, short } from "../../../lib/api";

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
  } catch {
    notFound();
  }
  const paidSum = receipt.acceptedEvidence.reduce(
    (s, e) => s + BigInt(e.payoutUnits),
    0n,
  );

  return (
    <main className="container">
      <section className="block">
        <h3>Evidence receipt · {receipt.id}</h3>
        <div className="panel">
          <dl className="kv">
            <dt>claim</dt>
            <dd>{receipt.targetClaim}</dd>
            <dt>bounty</dt>
            <dd className="mono">
              <Link href={`/gaps/${receipt.bountyId}`}>{receipt.bountyId}</Link>
            </dd>
            <dt>receipt hash</dt>
            <dd className="mono">{receipt.receiptHash}</dd>
            <dt>settlement hash</dt>
            <dd className="mono">{receipt.settlementHash}</dd>
            <dt>request hash</dt>
            <dd className="mono">{receipt.requestHash}</dd>
            <dt>network</dt>
            <dd className="mono">
              {receipt.network} · chain {receipt.chainId}
            </dd>
            <dt>contract</dt>
            <dd className="mono">{receipt.bountyContract}</dd>
            <dt>settlement tx</dt>
            <dd className="mono">{receipt.settlementTx ?? "—"}</dd>
            <dt>total paid</dt>
            <dd className="mono">
              {fmtUsdc(receipt.totalPaidUnits)} USDC (evidence {fmtUsdc(paidSum)}, fee{" "}
              {fmtUsdc(receipt.verifierFeeUnits)}, refund {fmtUsdc(receipt.refundUnits)})
            </dd>
            <dt>evaluator</dt>
            <dd className="mono">{receipt.evaluatorVersion}</dd>
            <dt>created</dt>
            <dd className="mono">{receipt.createdAt}</dd>
          </dl>
        </div>
      </section>

      <section className="block">
        <h3>Accepted evidence · {receipt.acceptedEvidence.length}</h3>
        <table className="market">
          <thead>
            <tr>
              <th>url</th>
              <th>supplier</th>
              <th>support</th>
              <th>payout</th>
              <th>content hash</th>
            </tr>
          </thead>
          <tbody>
            {receipt.acceptedEvidence.map((e) => (
              <tr key={e.submissionId}>
                <td>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.url}
                  </a>
                </td>
                <td className="mono">{short(e.supplierAddress, 6)}</td>
                <td className="mono">{(e.scores.support / 10000).toFixed(0)}%</td>
                <td className="mono">{fmtUsdc(e.payoutUnits)} USDC</td>
                <td className="mono muted">{short(e.contentHash, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {receipt.rejectedEvidence.length > 0 ? (
        <section className="block">
          <h3>Rejected · {receipt.rejectedEvidence.length}</h3>
          <table className="market">
            <tbody>
              {receipt.rejectedEvidence.map((e) => (
                <tr key={e.submissionId}>
                  <td className="muted">{e.url}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {e.reasons.join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="block">
        <h3>Raw receipt</h3>
        <pre className="json">{JSON.stringify(receipt, null, 2)}</pre>
        <p className="muted" style={{ fontSize: 12 }}>
          Verify independently:{" "}
          <span className="mono">gap402 receipt verify {receipt.id}</span>
        </p>
      </section>
    </main>
  );
}
