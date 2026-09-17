const ORDER = [
  "detected",
  "funded",
  "open",
  "submissions",
  "verified",
  "settled",
  "consumed",
] as const;

/** Lifecycle timeline: DETECTED → FUNDED → OPEN → SUBMISSIONS → VERIFIED → SETTLED → CONSUMED */
export function Lifecycle({ status }: { status: string }) {
  const current = ORDER.indexOf(status as (typeof ORDER)[number]);
  const dead = status === "cancelled" || status === "expired";
  return (
    <div className="timeline">
      {ORDER.map((s, i) => (
        <span
          key={s}
          className={`step ${dead ? "" : i < current ? "done" : i === current ? "now" : ""}`}
        >
          {s}
        </span>
      ))}
      {dead ? <span className="step now">{status}</span> : null}
    </div>
  );
}
