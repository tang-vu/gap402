"use client";
import { useState } from "react";
const sources = ["Primary announcement", "Independent report", "Archived rumor"];
export function DossierScene({
  chapter = 0,
  selected,
  onSelect,
}: {
  chapter?: number;
  selected?: number;
  onSelect?: (index: number) => void;
}) {
  const [local, setLocal] = useState(0);
  const active = selected ?? local;
  return (
    <div
      className={`dossier-scene chapter-${chapter}`}
      aria-label="Illustrative claim dossier"
    >
      <div className="scene-registration">
        <span>G/402 — EVIDENCE EXCHANGE</span>
        <span>FIG. 01</span>
      </div>
      <svg className="scene-lines" viewBox="0 0 600 580" fill="none" aria-hidden="true">
        <path
          d="M35 60H565M35 520H565M70 25V555M530 25V555"
          stroke="currentColor"
          opacity=".16"
        />
        <path
          d="M300 245V300M130 340V290H470V340M300 290V340M130 405V465H470V405M300 405V505"
          stroke="currentColor"
          strokeDasharray="3 6"
        />
        <circle cx="300" cy="290" r="5" fill="currentColor" />
        <path d="M20 30H40M30 20V40M560 550H580M570 540V560" stroke="currentColor" />
      </svg>
      <div className="claim-paper">
        <div className="paper-header">
          <span>CLAIM DOSSIER</span>
          <span>001 / FIXTURE</span>
        </div>
        <h2>
          Acme deployed
          <br />
          <em>WidgetNet in Vietnam.</em>
        </h2>
        <div className={`evidence-gap ${chapter >= 2 ? "filled" : ""}`}>
          <span>
            {chapter < 2
              ? "Supporting evidence missing"
              : `Inspecting source 0${active + 1}`}
          </span>
          <span aria-hidden="true">{chapter < 2 ? "+" : "↳"}</span>
        </div>
        <p>
          Declared rules. Traceable sources.
          <br />A decision you can inspect.
        </p>
      </div>
      <div className="scene-sources" aria-label="Illustrative sources">
        {sources.map((title, i) => (
          <button
            key={title}
            className={`scene-slip ${active === i ? "active" : ""}`}
            aria-pressed={active === i}
            onClick={() => {
              setLocal(i);
              onSelect?.(i);
            }}
          >
            <span className="slip-number">
              0{i + 1}
              <span aria-hidden="true">↗</span>
            </span>
            <strong>{title}</strong>
            <span className="slip-rule" />
            <small>
              {chapter < 2
                ? "Candidate source"
                : i === 2
                  ? "Rejected / stale"
                  : "Accepted / fixture"}
            </small>
          </button>
        ))}
      </div>
      <div className="scene-receipt">
        <span className="receipt-symbol" aria-hidden="true">
          ↳
        </span>
        <div>
          <span className="eyebrow">
            {chapter >= 4
              ? "Portable receipt"
              : chapter === 3
                ? "Exact allocation"
                : "A market for the missing piece"}
          </span>
          <strong>
            {chapter >= 4
              ? `Source 0${active + 1} → traceable entry`
              : chapter === 3
                ? "Every unit has a destination."
                : "From an open question to evidence."}
          </strong>
        </div>
      </div>
      <p className="scene-caption">ILLUSTRATIVE FIXTURE / NO TRANSACTION</p>
    </div>
  );
}
