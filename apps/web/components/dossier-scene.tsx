"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

const sources = ["Primary announcement", "Independent report", "Archived rumor"];

/** One set of physical objects moves through the entrance and scroll story. */
export function DossierScene({
  variant = "hero",
  selected,
  onSelect,
  onProgress,
}: {
  variant?: "hero" | "story";
  selected?: number;
  onSelect?: (index: number) => void;
  onProgress?: (progress: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [local, setLocal] = useState(0);
  const [playing, setPlaying] = useState(variant === "hero");
  const active = selected ?? local;
  useEffect(() => {
    const scene = root.current;
    if (!scene || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const paper = scene.querySelector(".claim-paper");
      const aperture = scene.querySelector(".aperture-leaf");
      const slips = gsap.utils.toArray<HTMLElement>(".scene-slip", scene);
      const paths = gsap.utils.toArray<SVGPathElement>(".scene-flow", scene);
      const receipt = scene.querySelector(".scene-receipt");
      const shadow = scene.querySelector(".dossier-shadow");
      const annotation = scene.querySelector(".annotation-leaf");
      const ribbon = scene.querySelector(".budget-ribbon");
      const marks = scene.querySelector(".aperture-marks");
      const headline = scene.querySelector(".claim-paper h2");
      const echo = scene.querySelector(".slip-echo");
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
      gsap.set(paths, { strokeDasharray: 500, strokeDashoffset: 500 });
      if (variant === "hero") {
        tl.fromTo(
          paper,
          { y: 74, rotationX: 18, rotationZ: -8, scale: 0.91 },
          {
            y: 0,
            rotationX: 0,
            rotationZ: -4,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
          },
          0,
        )
          .fromTo(
            shadow,
            { scale: 0.74, opacity: 0.15 },
            { scale: 1, opacity: 0.8, duration: 0.8 },
            0,
          )
          .fromTo(
            aperture,
            { clipPath: "inset(0 50% 0 50%)", rotationY: -32 },
            { clipPath: "inset(0 0% 0 0%)", rotationY: 0, duration: 1 },
            0.8,
          )
          .fromTo(
            marks,
            { opacity: 0, scale: 0.8 },
            { opacity: 1, scale: 1, duration: 0.65 },
            1.1,
          )
          .fromTo(
            headline,
            { clipPath: "inset(0 0 100% 0)" },
            { clipPath: "inset(0 0 0% 0)", duration: 1 },
            0.8,
          )
          .fromTo(
            annotation,
            { y: -22, opacity: 0, rotationZ: 7 },
            { y: 0, opacity: 0.85, rotationZ: -2, duration: 1.1 },
            1.4,
          );
        slips.forEach((slip, i) => {
          tl.fromTo(
            slip,
            {
              rotationZ: [-27, 23, 31][i] ?? 0,
              rotationY: [24, -30, 18][i] ?? 0,
              scale: 0.7,
              opacity: 0,
            },
            {
              motionPath: {
                path: [
                  { x: [-170, 135, 205][i] ?? 0, y: [145, 180, -140][i] ?? 0 },
                  { x: [-75, 70, 90][i] ?? 0, y: [-24, 82, 55][i] ?? 0 },
                  { x: 0, y: 0 },
                ],
                curviness: 1.25,
              },
              rotationZ: [2, -2, 3][i] ?? 0,
              rotationY: 0,
              scale: 1,
              opacity: 1,
              duration: 1.5,
              ease: "power3.out",
            },
            1.8 + i * 0.22,
          );
        });
        tl.to(paths, { strokeDashoffset: 0, duration: 1.1, stagger: 0.12 }, 3.3).fromTo(
          receipt,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          4.4,
        );
        tl.duration(5).play(0);
      } else {
        gsap.set(aperture, { clipPath: "inset(0 0% 0 0%)" });
        tl.to(paper, { rotationZ: 0, rotationX: 0, y: -20, scale: 1.03, duration: 20 }, 0)
          .fromTo(marks, { opacity: 0.25 }, { opacity: 1, duration: 20 }, 0)
          .to(annotation, { x: 25, y: -22, rotationZ: -6, duration: 20 }, 0)
          .to(slips, { y: -38, rotationZ: 0, stagger: 2, duration: 22 }, 20)
          .fromTo(
            echo,
            { x: 75, y: -35, rotationZ: 16, scale: 0.9, opacity: 0.8 },
            { x: 0, y: 0, rotationZ: 0, scale: 0.05, opacity: 0, duration: 18 },
            24,
          )
          .to(slips[2]!, { x: 65, y: 50, rotationZ: 15, opacity: 0.6, duration: 20 }, 28)
          .to(paths, { strokeDashoffset: 0, stagger: 3, duration: 25 }, 48)
          .to(ribbon, { scaleX: 1, duration: 25 }, 48)
          .to(paper, { y: -42, scale: 0.91, rotationZ: 2, duration: 24 }, 76)
          .to(receipt, { y: -60, scale: 1.08, opacity: 1, duration: 24 }, 76);
        tl.duration(100);
        const trigger = ScrollTrigger.create({
          trigger: scene.closest(".story-layout"),
          start: "top 28%",
          end: "bottom 72%",
          scrub: 0.35,
          onUpdate: (self) => {
            tl.progress(self.progress);
            onProgress?.(self.progress);
          },
        });
        timeline.current = tl;
        return () => trigger.kill();
      }
      timeline.current = tl;
    }, scene);
    return () => {
      timeline.current = null;
      context.revert();
    };
  }, [variant, onProgress]);
  function replay() {
    timeline.current?.restart();
    setPlaying(true);
  }
  function pause() {
    if (!timeline.current) return;
    if (timeline.current.paused()) {
      timeline.current.resume();
      setPlaying(true);
    } else {
      timeline.current.pause();
      setPlaying(false);
    }
  }
  return (
    <div
      ref={root}
      className={`dossier-scene dossier-${variant}`}
      aria-label="Illustrative claim dossier"
    >
      <div className="dossier-shadow" aria-hidden="true" />
      <div className="dossier-stack" aria-hidden="true" />
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
        <path className="scene-flow" d="M130 390Q155 315 300 315" stroke="currentColor" />
        <path className="scene-flow" d="M300 390Q300 330 300 315" stroke="currentColor" />
        <path className="scene-flow" d="M470 390Q450 315 300 315" stroke="currentColor" />
        <path className="scene-flow" d="M300 355Q330 445 300 495" stroke="currentColor" />
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
        <div className="aperture-marks" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="evidence-gap">
          <span>Supporting evidence missing</span>
          <span aria-hidden="true">+</span>
        </div>
        <div className="aperture-leaf" aria-hidden="true">
          <span>OPEN / EVIDENCE REQUIRED</span>
        </div>
        <p>
          Declared rules. Traceable sources.
          <br />A decision you can inspect.
        </p>
      </div>
      <div className="annotation-leaf" aria-hidden="true">
        REVIEW WINDOW <span>30 DAYS / 600,000</span>
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
            {i === 0 && (
              <span className="slip-echo" aria-hidden="true">
                TRACKING LINK / SAME SOURCE
              </span>
            )}
            <span className="slip-rule" />
            <small>{i === 2 ? "Stale / rejected" : "Candidate / fixture"}</small>
          </button>
        ))}
      </div>
      <div className="budget-ribbon" aria-hidden="true">
        <span>SUPPLIER</span>
        <span>VERIFIER</span>
        <span>REFUND</span>
      </div>
      <div className="scene-receipt">
        <span className="receipt-symbol" aria-hidden="true">
          ↳
        </span>
        <div>
          <span className="eyebrow">Portable receipt / illustrative</span>
          <strong>Source 0{active + 1} → traceable entry</strong>
        </div>
      </div>
      <p className="scene-caption">ILLUSTRATIVE FIXTURE / NO TRANSACTION</p>
      {variant === "hero" && (
        <div className="scene-controls">
          <button type="button" onClick={pause}>
            {playing ? "Pause motion" : "Play motion"}
          </button>
          <button type="button" onClick={replay}>
            Replay motion ↺
          </button>
          <span>Scroll to inspect ↓</span>
        </div>
      )}
    </div>
  );
}
