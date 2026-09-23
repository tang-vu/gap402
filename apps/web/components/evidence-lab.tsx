"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import {
  fmtUsdc,
  type Gap,
  type Submission,
  type Evaluation,
  type SettlementPlan,
  type Receipt,
} from "../lib/api";
import { Requirements } from "./requirements";
import { EvidenceWorkspace } from "./evidence-workspace";
import { Allocation } from "./allocation";
import { DossierScene } from "./dossier-scene";
import { SourceJourney } from "./source-journey";
const ProofInspector = dynamic(
  () => import("./proof-inspector").then((m) => m.ProofInspector),
  { loading: () => <p role="status">Opening the local proof inspector…</p> },
);
type Scenario = "mixed" | "rejected" | "insufficient";
type Run = {
  gap: Gap;
  submissions: Submission[];
  evaluations: Evaluation[];
  plan: SettlementPlan | null;
  receipt: Receipt | null;
  before: string;
  after: string;
  duplicatePrevented: boolean;
  blockedReason: string | null;
  actualSpendUnits: string;
  sourceMode: string;
  verifierMode: string;
};
const scenarios: [Scenario, string, string][] = [
  [
    "mixed",
    "A useful discovery",
    "Two useful sources, a stale rumor and a prevented duplicate.",
  ],
  [
    "rejected",
    "Nothing holds up",
    "Zero supplier payout. The verifier fee and refund remain explicit.",
  ],
  [
    "insufficient",
    "Almost enough",
    "Useful evidence, but too few qualifying domains. Settlement stops.",
  ],
];
const chapters = [
  "Missing evidence",
  "Requirements",
  "Source inspection",
  "Allocation",
  "Portable receipt",
];
export function EvidenceLab() {
  const [scenario, setScenario] = useState<Scenario>("mixed");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chapter, setChapter] = useState(0);
  const [selected, setSelected] = useState("");
  const [motionTime, setMotionTime] = useState(0);
  const [motionPlaying, setMotionPlaying] = useState(false);
  const motion = useRef<gsap.core.Timeline | null>(null);
  const cache = useRef<Partial<Record<Scenario, Run>>>({});
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!run) return;
    const root = document.querySelector(".lab-replay");
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const source = root.querySelector('.journey-sources button[aria-pressed="true"]');
      const trace = root.querySelector(".journey-trace");
      const connector = root.querySelector(".journey-connector");
      const stages = root.querySelectorAll(".journey-trace > div");
      const arrows = root.querySelectorAll(".journey-arrow");
      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => {
          const time = tl.time();
          setMotionTime(time);
          const next = time < 2 ? 0 : time < 4 ? 1 : time < 6.5 ? 2 : time < 8.3 ? 3 : 4;
          setChapter((current) => (current === next ? current : next));
        },
        onComplete: () => setMotionPlaying(false),
      });
      tl.fromTo(
        source,
        { y: -30, rotation: -8, scale: 0.85, boxShadow: "0 2px 2px #272c2510" },
        {
          y: 0,
          rotation: -2,
          scale: 1,
          boxShadow: "0 14px 20px #272c2538",
          duration: 2,
          ease: "power3.out",
        },
        0,
      )
        .fromTo(
          connector,
          { scaleY: 0, opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 1.3 },
          1.7,
        )
        .fromTo(
          trace,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", duration: 2.2 },
          2.1,
        )
        .fromTo(stages[1]!, { y: 30 }, { y: 0, duration: 1.4 }, 4)
        .fromTo(
          arrows,
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, stagger: 0.35, duration: 1.1 },
          5.6,
        )
        .fromTo(stages[2]!, { y: 30 }, { y: 0, duration: 1.4 }, 6.5)
        .to(source, { y: 0, rotation: 0, scale: 1.04, duration: 1 }, 8.3);
      tl.duration(10);
      if (!run.plan) tl.addPause(6.5, () => setMotionPlaying(false));
      motion.current = tl;
      tl.play(0);
      setMotionPlaying(true);
    }, root);
    return () => {
      motion.current = null;
      context.revert();
    };
  }, [run, selected]);
  function seekChapter(index: number) {
    motion.current?.pause([0, 2, 4, 6.5, 8.3][index] ?? 0);
    setMotionPlaying(false);
    setChapter(index);
  }
  function selectSource(id: string) {
    setSelected(id);
  }
  function install(value: Run | null) {
    setRun(value);
    setChapter(0);
    setSelected(value?.submissions[0]?.id ?? "");
    setMotionTime(0);
  }
  function change(value: Scenario) {
    generation.current++;
    request.current?.abort();
    setBusy(false);
    setError("");
    setScenario(value);
    install(cache.current[value] ?? null);
  }
  async function start() {
    if (cache.current[scenario]) {
      install(cache.current[scenario]!);
      motion.current?.restart();
      setMotionPlaying(true);
      return;
    }
    const token = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 20000);
    setBusy(true);
    setError("");
    install(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
        signal: controller.signal,
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? "The experiment could not be completed.");
      if (token !== generation.current) return;
      cache.current[scenario] = body;
      install(body);
    } catch (e) {
      if (token === generation.current)
        setError(
          controller.signal.aborted
            ? "The experiment timed out. No result was received. Retry when the service is available."
            : e instanceof Error
              ? e.message
              : "The experiment could not be completed.",
        );
    } finally {
      clearTimeout(timeout);
      if (token === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <section className="lab-controls panel">
        <div className="simulation-note">
          <div>
            <strong>Isolated simulation / No wallet required</strong>
            <p>
              Synthetic fixtures · Mock semantic scoring · Real allocation logic. The API
              returns a completed scenario. Chapters below replay that result; they are
              not live agent execution.
            </p>
          </div>
          <div className="simulation-spend">
            Actual spend<b>{run ? fmtUsdc(run.actualSpendUnits) : "0"} USDC</b>
          </div>
        </div>
        <fieldset className="scenario-grid">
          <legend>Choose a case file</legend>
          {scenarios.map(([value, title, description], i) => (
            <label className="scenario-choice" key={value}>
              <input
                type="radio"
                name="scenario"
                value={value}
                checked={scenario === value}
                onChange={() => change(value)}
              />
              <span className="scenario-number">CASE / 0{i + 1}</span>
              <strong>{title}</strong>
              <small>{description}</small>
            </label>
          ))}
        </fieldset>
        <div className="lab-action">
          <button className="btn primary" onClick={start} disabled={busy}>
            {busy
              ? "Requesting completed scenario…"
              : run
                ? "Replay this result"
                : error
                  ? "Retry experiment"
                  : "Run this experiment"}
            <span aria-hidden="true">↗</span>
          </button>
          {run && (
            <button
              className="btn"
              onClick={() => {
                install(null);
                setError("");
              }}
            >
              Restart walkthrough
            </button>
          )}
          <p role="status">
            {busy
              ? "Waiting for checks and allocation. You may switch cases to cancel."
              : run
                ? "Completed result cached for this session. Replay makes no new request."
                : "Simulated budget: 0.050000 USDC · Actual spend: 0 USDC"}
          </p>
        </div>
        {error && (
          <div className="request-error" role="alert">
            <strong>The dossier is still open.</strong>
            <p>{error}</p>
            <p>
              No successful step is inferred. Retry the experiment, or inspect an existing
              proof at <a href="/verify">the proof desk</a>.
            </p>
          </div>
        )}
      </section>
      {!run && (
        <div className="lab-waiting">
          <div>
            <p className="eyebrow">From missing evidence to a portable record</p>
            <h2>
              What does
              <br />
              <em>good evidence earn?</em>
            </h2>
            <p>
              Choose a case. Follow the same source through checks, allocation and
              receipt.
            </p>
            <ol className="waiting-steps">
              {chapters.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          </div>
          <DossierScene />
        </div>
      )}
      {run && (
        <section className="lab-replay">
          <div className="run-summary" role="status">
            <p>
              <strong>Experiment complete.</strong>{" "}
              {run.blockedReason
                ? "The domain requirement stopped settlement."
                : "Allocation returned. Inspect the outcome below."}
            </p>
            <span className="mono">LAB REPLAY / SYNTHETIC FIXTURES</span>
          </div>
          <div className="lab-dossier">
            <aside className="claim-anchor">
              <p className="eyebrow">Persistent claim dossier / {scenario}</p>
              <h2>{run.gap.claim}</h2>
              <div className="claim-budget">
                <span>Simulated budget</span>
                <strong>
                  {fmtUsdc(run.gap.budgetUnits)} <small>USDC</small>
                </strong>
              </div>
              <Requirements requirements={run.gap.requirements} />
            </aside>
            <div className="replay-main">
              <nav className="replay-nav" aria-label="Replay chapters">
                {chapters.map((label, i) => (
                  <button
                    key={label}
                    aria-current={chapter === i ? "step" : undefined}
                    onClick={() => seekChapter(i)}
                  >
                    <span>0{i + 1}</span>
                    {label}
                  </button>
                ))}
              </nav>
              <div
                className="motion-transport"
                role="group"
                aria-label="Completed result playback"
              >
                <button
                  onClick={() => {
                    if (motion.current?.paused()) {
                      motion.current.play();
                      setMotionPlaying(true);
                    } else {
                      motion.current?.pause();
                      setMotionPlaying(false);
                    }
                  }}
                >
                  {motionPlaying ? "Pause playback" : "Play playback"}
                </button>
                <button
                  onClick={() => {
                    motion.current?.restart();
                    setMotionPlaying(true);
                  }}
                >
                  Replay from start
                </button>
                <input
                  aria-label="Seek completed result"
                  type="range"
                  min="0"
                  max="10"
                  step="0.01"
                  value={motionTime}
                  onChange={(event) => {
                    motion.current?.pause(Number(event.target.value));
                    setMotionPlaying(false);
                  }}
                />
                <span className="mono">{motionTime.toFixed(1)} / 10.0 s</span>
              </div>
              <div className="replay-chapter" aria-live="polite">
                <p className="eyebrow">Completed result / Chapter 0{chapter + 1}</p>
                <h2>
                  {
                    [
                      "A question stays open.",
                      "The terms are explicit.",
                      "Inspect the contribution.",
                      run.plan ? "Every unit, accounted for." : "A useful refusal.",
                      run.receipt
                        ? "The record travels with you."
                        : "No receipt was issued.",
                    ][chapter]
                  }
                </h2>
                {chapter === 0 && (
                  <>
                    <p className="chapter-lede">{run.before}</p>
                    <div className="missing-evidence">
                      <span aria-hidden="true">[ ? ]</span>
                      <p>
                        The gap is in the supporting evidence.
                        <br />
                        The next step is a request with explicit criteria.
                      </p>
                    </div>
                  </>
                )}
                {chapter === 1 && (
                  <>
                    <p className="chapter-lede">
                      The rules at left belong to this returned bounty. They precede
                      evaluation and allocation.
                    </p>
                    <p>
                      {run.duplicatePrevented
                        ? "Tracking-link duplicate prevented: the repost creates no second submission and earns no second reward."
                        : "No duplicate submitted in this scenario."}
                    </p>
                  </>
                )}
                {chapter === 2 && (
                  <p className="chapter-lede">
                    Select a source below. Its identity remains selected when you move to
                    allocation or the receipt.
                  </p>
                )}
                {chapter === 3 &&
                  (run.plan ? (
                    <Allocation
                      plan={run.plan}
                      budget={run.gap.budgetUnits}
                      submissions={run.submissions}
                      selected={selected}
                      onSelect={selectSource}
                    />
                  ) : (
                    <div className="refusal">
                      <span className="pill warn">Settlement blocked</span>
                      <h3>The domain requirement is unmet.</h3>
                      <p>{run.blockedReason}</p>
                      <p>
                        No payout plan or receipt exists. The next action is to obtain
                        evidence from additional qualifying domains, then evaluate again.
                      </p>
                    </div>
                  ))}
                {chapter === 4 && (
                  <>
                    <p className="chapter-lede">{run.after}</p>
                    {run.receipt ? (
                      <div className="receipt-preview">
                        <span className="eyebrow">Evidence receipt / simulation</span>
                        <h3>
                          {run.receipt.acceptedEvidence.length} accepted ·{" "}
                          {run.receipt.rejectedEvidence.length} rejected
                        </h3>
                        <p>No settlement or registry transaction was submitted.</p>
                        <code>{run.receipt.receiptHash}</code>
                        <a className="text-link" href="#lab-proof">
                          Inspect or export the complete proof ↓
                        </a>
                      </div>
                    ) : (
                      <div className="refusal">
                        <p>{run.blockedReason}</p>
                        <p>
                          Resolve the unmet requirement before attempting settlement. Try
                          the mixed case to compare a completed allocation.
                        </p>
                      </div>
                    )}
                  </>
                )}
                <SourceJourney
                  submissions={run.submissions}
                  evaluations={run.evaluations}
                  plan={run.plan}
                  receipt={run.receipt}
                  selected={selected}
                  onSelect={selectSource}
                  chapter={chapter}
                />
                <div className="chapter-actions">
                  <button
                    className="btn"
                    disabled={chapter === 0}
                    onClick={() => seekChapter(chapter - 1)}
                  >
                    ← Previous
                  </button>
                  <span className="mono">0{chapter + 1} / 05</span>
                  <button
                    className="btn"
                    disabled={chapter === 4}
                    onClick={() => seekChapter(chapter + 1)}
                  >
                    Next chapter →
                  </button>
                </div>
              </div>
              <EvidenceWorkspace
                submissions={run.submissions}
                evaluations={run.evaluations}
                plan={run.plan}
                receipt={run.receipt}
                selected={selected}
                onSelect={selectSource}
                showAllocation={false}
              />
              {run.duplicatePrevented && (
                <p className="duplicate-note">
                  ↳ Tracking-link duplicate prevented. No second source entry or reward.
                </p>
              )}
            </div>
          </div>
          {chapter === 4 && run.receipt && (
            <div id="lab-proof">
              <ProofInspector
                key={run.gap.id}
                initialBundle={{ gap: run.gap, plan: run.plan, receipt: run.receipt }}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}
