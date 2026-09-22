"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DossierScene } from "./dossier-scene";
const chapters = [
  [
    "The missing piece",
    "A claim is not yet a conclusion.",
    "Acme deployed WidgetNet in Vietnam. The research agent has a claim, but no admissible evidence. The honest next step is to keep the question open.",
  ],
  [
    "The invitation",
    "Define what would change your mind.",
    "The illustrative bounty asks for sources no older than 30 days and a support score of at least 600,000 out of 1,000,000. The lab uses a simulated 0.050000 USDC budget.",
  ],
  [
    "The inspection",
    "Every source gets its own hearing.",
    "A primary announcement and an independent report qualify in the mixed fixture. A stale rumor fails. A tracking-link repost is prevented from becoming a second submission. Select a numbered slip to keep it in focus.",
  ],
  [
    "The allocation",
    "Useful evidence earns its share.",
    "The allocator weighs qualifying contributions. Supplier rewards, the verifier fee and requester refund reconcile exactly. Open the lab for the actual returned amounts and each payment’s explanation.",
  ],
  [
    "The record",
    "Take the reasoning with you.",
    "The Evidence Receipt carries source entries, allocation and hashes into a portable bundle. Local checks establish internal consistency, not factual truth or independent registry authentication.",
  ],
];
export function EvidenceStory() {
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setChapter(Number((entry.target as HTMLElement).dataset.chapter));
      },
      { rootMargin: "-15% 0px -50% 0px", threshold: 0 },
    );
    root.current
      ?.querySelectorAll("[data-chapter]")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return (
    <section className="evidence-story" ref={root} aria-label="One claim, five chapters">
      <div className="story-heading">
        <p className="eyebrow">One claim / Five chapters / Illustrative fixture</p>
        <h2>
          The evidence becomes
          <br />
          <em>the story.</em>
        </h2>
      </div>
      <nav className="chapter-nav" aria-label="Story chapters">
        {chapters.map(([label], i) => (
          <a
            key={label}
            href={`#chapter-${i}`}
            aria-current={chapter === i ? "step" : undefined}
            onClick={() => setChapter(i)}
          >
            <span>0{i + 1}</span>
            {label}
          </a>
        ))}
      </nav>
      <div className="story-layout">
        <div className="story-stage">
          <DossierScene chapter={chapter} selected={selected} onSelect={setSelected} />
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
              {i >= 2 && (
                <p className="story-source">
                  Following source 0{selected + 1} /{" "}
                  {selected === 2
                    ? "Archived rumor"
                    : selected === 1
                      ? "Independent report"
                      : "Primary announcement"}
                </p>
              )}
              {i === 4 && (
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
