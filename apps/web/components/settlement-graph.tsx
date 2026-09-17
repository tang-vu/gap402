import { fmtUsdc, type SettlementPlan } from "../lib/api";

/** Settlement flow: bounty on the left fans out to recipients on the right. */
export function SettlementGraph({ plan }: { plan: SettlementPlan }) {
  const total = BigInt(plan.distributableUnits) + BigInt(plan.verifierFeeUnits);
  const rows = [
    ...plan.payouts.map((p) => ({
      to: p.recipient,
      label:
        p.submissionId === "verifier-fee" ? "verifier fee" : p.submissionId.slice(0, 14),
      amount: BigInt(p.amountUnits),
      kind: p.submissionId === "verifier-fee" ? "fee" : "evidence",
    })),
    ...(BigInt(plan.refundUnits) > 0n
      ? [
          {
            to: "requester",
            label: "refund",
            amount: BigInt(plan.refundUnits),
            kind: "refund",
          },
        ]
      : []),
  ];
  const W = 560;
  const rowH = 34;
  const H = Math.max(90, 40 + rows.length * rowH);
  const cy = H / 2;
  const color = (k: string) =>
    k === "fee" ? "#d9a441" : k === "refund" ? "#8b939e" : "#3fb96d";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="settlement graph">
      <rect
        x={20}
        y={cy - 26}
        width={130}
        height={52}
        rx={8}
        fill="#161a20"
        stroke="#4f8ef7"
        strokeWidth={1.5}
      />
      <text
        x={85}
        y={cy - 4}
        textAnchor="middle"
        fill="#e6e9ed"
        fontSize={10}
        fontFamily="monospace"
      >
        BOUNTY
      </text>
      <text
        x={85}
        y={cy + 12}
        textAnchor="middle"
        fill="#4f8ef7"
        fontSize={11}
        fontFamily="monospace"
      >
        {fmtUsdc(total)} USDC
      </text>
      {rows.map((r, i) => {
        const y = 30 + i * rowH;
        const w = Math.max(2, (Number(r.amount) / Number(total)) * 160);
        return (
          <g key={i}>
            <path
              d={`M 150 ${cy} C 300 ${cy}, 300 ${y + 8}, 410 ${y + 8}`}
              fill="none"
              stroke={color(r.kind)}
              strokeWidth={1}
              opacity={0.5}
            />
            <rect
              x={410}
              y={y - 6}
              width={w}
              height={16}
              rx={3}
              fill={color(r.kind)}
              opacity={0.25}
            />
            <text x={410} y={y + 16} fill="#8b939e" fontSize={8} fontFamily="monospace">
              {r.label} · {r.to.slice(0, 10)}…
            </text>
            <text
              x={545}
              y={y + 4}
              textAnchor="end"
              fill={color(r.kind)}
              fontSize={10}
              fontFamily="monospace"
            >
              {fmtUsdc(r.amount)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
