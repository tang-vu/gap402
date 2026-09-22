import { readableRequirements } from "../lib/presentation";
export function Requirements({
  requirements,
}: {
  requirements: Record<string, unknown>;
}) {
  const rules = readableRequirements(requirements);
  const inactive = new Set(["No", "0", "any", "None specified"]);
  const active = rules.filter((rule) => !inactive.has(rule.value));
  const additional = rules.filter((rule) => inactive.has(rule.value));
  return (
    <div className="requirements">
      <p className="eyebrow">Acceptance rules / fixed before submission</p>
      <dl>
        {active.map((rule) => (
          <div key={rule.label}>
            <dt>{rule.label}</dt>
            <dd>{rule.value}</dd>
          </div>
        ))}
      </dl>
      {additional.length > 0 && (
        <details>
          <summary>Other declared rules ({additional.length})</summary>
          <dl>
            {additional.map((rule) => (
              <div key={rule.label}>
                <dt>{rule.label}</dt>
                <dd>{rule.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <p className="muted">
        Domain diversity is a metadata constraint; it does not establish independent
        ownership or source truth.
      </p>
      <details>
        <summary>Advanced / requirement JSON</summary>
        <pre className="json">{JSON.stringify(requirements, null, 2)}</pre>
      </details>
    </div>
  );
}
