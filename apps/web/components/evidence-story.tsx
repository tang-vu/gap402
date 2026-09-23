"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { DossierScene } from "./dossier-scene";
const chapters = [
  [
    "Request",
    "Define what would change your mind.",
    "The claim stays open. The illustrative request declares sources no older than 30 days, a support score of at least 600,000 out of 1,000,000 and a simulated 0.050000 USDC budget.",
  ],
  [
    "Inspect",
    "Every source gets its own hearing.",
    "A primary announcement and an independent report qualify in the mixed fixture. A stale rumor fails. A tracking-link repost is prevented from becoming a second submission. Select a numbered slip to keep it in focus.",
  ],
  [
    "Allocate",
    "Useful evidence earns its share.",
    "The allocator weighs qualifying contributions. Supplier rewards, the verifier fee and requester refund reconcile exactly. Open the lab for the actual returned amounts and each payment’s explanation.",
  ],
  [
    "Record",
    "Take the reasoning with you.",
    "The Evidence Receipt carries source entries, allocation and hashes into a portable bundle. Local checks establish internal consistency, not factual truth or independent registry authentication.",
  ],
];
export function EvidenceStory() {
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLElement>(null);
  const update = useCallback((progress: number) => {
    const next = progress < 0.2 ? 0 : progress < 0.48 ? 1 : progress < 0.76 ? 2 : 3;
    setChapter((current) => (current === next ? current : next));
  }, []);
  function seek(index: number) {
    const layout = root.current?.querySelector(".story-layout");
    if (!layout) return;
    const stops = [0.1, 0.34, 0.62, 0.88];
    const start = layout.getBoundingClientRect().top + scrollY - innerHeight * 0.28;
    const distance = layout.getBoundingClientRect().height - innerHeight * 0.44;
    scrollTo({ top: start + distance * (stops[index] ?? 0), behavior: "smooth" });
    setChapter(index);
  }
  return (
    <section
      className="evidence-story"
      ref={root}
      aria-label="One dossier, four chapters"
    >
      <div className="story-heading">
        <p className="eyebrow">One dossier / Four chapters / Illustrative fixture</p>
        <h2>
          The evidence becomes
          <br />
          <em>the story.</em>
        </h2>
      </div>
      <nav className="chapter-nav" aria-label="Story chapters">
        {chapters.map(([label], i) => (
          <button
            key={label}
            aria-current={chapter === i ? "step" : undefined}
            onClick={() => seek(i)}
          >
            <span>0{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="story-layout">
        <div className="story-stage">
          <DossierScene
            variant="story"
            selected={selected}
            onSelect={setSelected}
            onProgress={update}
          />
        </div>
        <div>
          {chapters.map(([label, title, copy], i) => (
            <article
              className="story-chapter"
              id={`chapter-${i}`}
              data-chapter={i}
              key={label}
            >
              <span className="chapter-index">0{i + 1}</span>
              <p className="eyebrow">{label}</p>
              <h3>{title}</h3>
              <p>{copy}</p>
              {i >= 1 && (
                <p className="story-source">
                  Following source 0{selected + 1} /{" "}
                  {selected === 2
                    ? "Archived rumor"
                    : selected === 1
                      ? "Independent report"
                      : "Primary announcement"}
                </p>
              )}
              {i === 3 && (
                <Link href="/lab" className="btn primary">
                  Explore the evidence lab ↗
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
