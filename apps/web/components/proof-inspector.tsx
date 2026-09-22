"use client";

import { useRef, useState } from "react";
import { verifyBundle } from "@gap402/protocol";

const checkDescriptions: Record<string, string> = {
  schema: "The gap, plan and receipt match the required protocol schemas.",
  receiptHash: "The canonical receipt content matches its recorded hash.",
  uniqueEvidence: "No submission identifier appears twice in the receipt.",
  accounting:
    "Accepted evidence allocations plus the verifier fee equal the receipt’s total paid.",
  requestHash: "The original bounty specification matches the receipt’s request hash.",
  settlementHash: "The canonical plan matches both recorded settlement hashes.",
  binding: "The bounty identifiers and target claims agree across all three records.",
  budget:
    "Payouts plus refund equal the bounty; distributable budget plus fee also reconcile.",
  totals: "The payout sum, total paid, refund and fee agree between plan and receipt.",
  fees: "Fee rows sum to the recorded fee and use the declared verifier address.",
  payouts:
    "Supplier identifiers, recipients and exact amounts agree between plan and accepted evidence.",
};

export function ProofInspector({ initialBundle }: { initialBundle?: unknown }) {
  const [text, setText] = useState(
    initialBundle ? JSON.stringify(initialBundle, null, 2) : "",
  );
  const [result, setResult] = useState<ReturnType<typeof verifyBundle> | null>(null);
  const [error, setError] = useState("");
  const revision = useRef(0);
  async function openFile(file: File | undefined) {
    if (!file) return;
    const current = ++revision.current;
    setResult(null);
    setError("");
    if (file.size > 1000000) {
      setError("Choose a JSON proof smaller than 1 MB.");
      return;
    }
    try {
      const content = await file.text();
      if (current !== revision.current) return;
      setText(content);
      try {
        JSON.parse(content);
      } catch {
        setError(
          "This file contains malformed JSON. Correct it below, or choose another proof.",
        );
      }
    } catch {
      if (current === revision.current)
        setError("This file could not be read. Try pasting its JSON below.");
    }
  }
  function check() {
    setError("");
    setResult(null);
    if (new TextEncoder().encode(text).length > 1000000) {
      setError("Choose a JSON proof smaller than 1 MB.");
      return;
    }
    try {
      setResult(verifyBundle(JSON.parse(text)));
    } catch {
      setError(
        "Invalid JSON. Paste a Gap402 proof bundle containing gap, plan and receipt.",
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gap402-proof.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="block proof-desk">
      <div className="proof-desk-heading">
        <div>
          <p className="eyebrow">Local processing / 1 MB maximum</p>
          <h2>Inspect a portable proof.</h2>
        </div>
        <span className="proof-mark" aria-hidden="true">
          [ ↳ ]
        </span>
      </div>
      <p>
        Checks run in your browser, without uploading the bundle. Verify the
        specification, payout recipients, exact budget and receipt hash. Try changing a
        payout to see the check fail.
      </p>
      <div className="proof-tools">
        <label htmlFor="proof-json">Proof bundle / JSON</label>
        <input
          className="file-input"
          type="file"
          accept=".json,application/json"
          aria-label="Open a proof JSON file locally"
          onChange={(e) => {
            void openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <textarea
        id="proof-json"
        className="proof-input mono"
        value={text}
        maxLength={1000000}
        onChange={(e) => {
          revision.current++;
          setText(e.target.value);
          setResult(null);
          setError("");
        }}
        spellCheck={false}
        placeholder={'{\n  "gap": { ... },\n  "plan": { ... },\n  "receipt": { ... }\n}'}
      />
      <div className="cta-row">
        <button className="btn primary" onClick={check} disabled={!text.trim()}>
          Verify in browser
        </button>
        <button className="btn" onClick={download} disabled={!text}>
          Download JSON
        </button>
      </div>
      <div aria-live="polite">
        {error && <p role="alert">{error}</p>}
        {result && (
          <div className="panel proof-result">
            <h4>
              {result.valid
                ? "Integrity checks passed"
                : "Integrity checks failed — do not consume"}
            </h4>
            <div className="check-grid">
              {Object.entries(result.checks).map(([name, pass]) => (
                <div className="proof-check" key={name}>
                  <span className={pass ? "check-pass" : "check-fail"}>
                    {pass ? "Pass" : "Fail"}
                  </span>
                  <strong>{name}</strong>
                  <p>{checkDescriptions[name] ?? "Protocol check."}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="muted">
        Integrity is not proof of factual truth. Chain anchoring is not checked here:
        compare the hash against the receipt registry on the stated network. A
        self-consistent forged bundle can pass offline checks.
      </p>
    </section>
  );
}
