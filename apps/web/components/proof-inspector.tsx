"use client";

import { useState } from "react";
import { verifyBundle } from "@gap402/protocol";

export function ProofInspector({ initialBundle }: { initialBundle?: unknown }) {
  const [text, setText] = useState(
    initialBundle ? JSON.stringify(initialBundle, null, 2) : "",
  );
  const [result, setResult] = useState<ReturnType<typeof verifyBundle> | null>(null);
  const [error, setError] = useState("");
  async function openFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError("");
    if (file.size > 1000000) {
      setError("Choose a JSON proof smaller than 1 MB.");
      return;
    }
    try {
      setText(await file.text());
    } catch {
      setError("This file could not be read. Try pasting its JSON below.");
    }
  }
  function check() {
    setError("");
    setResult(null);
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
    <section className="block">
      <h3>Inspect a portable proof</h3>
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
                <p key={name}>
                  {pass ? "✓" : "×"} {name}
                </p>
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
