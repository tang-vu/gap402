import type { Evaluation, Submission } from "../lib/api";

/**
 * Radial evidence graph: the target claim sits at the centre, submissions
 * orbit it. Colour encodes the verifier verdict.
 */
export function EvidenceGraph({
  claim,
  submissions,
  evaluations,
}: {
  claim: string;
  submissions: Submission[];
  evaluations: Evaluation[];
}) {
  const verdict = new Map(evaluations.map((e) => [e.submissionId, e]));
  const W = 560;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;
  const R = 120;

  const color = (s: Submission): string => {
    const e = verdict.get(s.id);
    if (!e) return "#8b939e"; // pending
    if (e.verdict === "rejected") {
      return e.rejectReasons.some((r) => r.includes("duplicate")) ? "#d9a441" : "#e05d5d";
    }
    return s.claimRelation === "contradicts" ? "#d9a441" : "#3fb96d";
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="evidence graph">
      <circle cx={cx} cy={cy} r={46} fill="#161a20" stroke="#4f8ef7" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="#e6e9ed"
        fontSize={10}
        fontFamily="monospace"
      >
        TARGET CLAIM
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#8b939e"
        fontSize={8}
        fontFamily="monospace"
      >
        {claim.length > 34 ? claim.slice(0, 34) + "…" : claim}
      </text>
      {submissions.map((s, i) => {
        const a = (2 * Math.PI * i) / Math.max(1, submissions.length) - Math.PI / 2;
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);
        const e = verdict.get(s.id);
        const host = (() => {
          try {
            return new URL(s.canonicalUrl).hostname;
          } catch {
            return s.canonicalUrl;
          }
        })();
        return (
          <g key={s.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#23282f" strokeDasharray="3 3" />
            <circle
              cx={x}
              cy={y}
              r={22}
              fill="#111418"
              stroke={color(s)}
              strokeWidth={1.5}
            />
            <text
              x={x}
              y={y - 1}
              textAnchor="middle"
              fill={color(s)}
              fontSize={8}
              fontFamily="monospace"
            >
              {e ? e.verdict.toUpperCase() : "PENDING"}
            </text>
            <text
              x={x}
              y={y + 9}
              textAnchor="middle"
              fill="#8b939e"
              fontSize={7}
              fontFamily="monospace"
            >
              {host}
            </text>
            <text
              x={x}
              y={y + 32}
              textAnchor="middle"
              fill="#8b939e"
              fontSize={7}
              fontFamily="monospace"
            >
              {e ? `support ${(e.scores.support / 10000).toFixed(0)}%` : ""}
            </text>
          </g>
        );
      })}
      {submissions.length === 0 ? (
        <text
          x={cx}
          y={cy + 80}
          textAnchor="middle"
          fill="#8b939e"
          fontSize={10}
          fontFamily="monospace"
        >
          awaiting supplier submissions
        </text>
      ) : null}
    </svg>
  );
}
