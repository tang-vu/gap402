"use client";
import Link from "next/link";
import { useState } from "react";
import { fmtUsdc, type GapView } from "../lib/api";
import { register, utcDate } from "../lib/presentation";
export function MarketRegister({
  gaps,
  compact = false,
}: {
  gaps: GapView[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("deadline");
  const visible = register(gaps, query, status, sort);
  return (
    <div className="market-register">
      {!compact && (
        <div className="register-tools">
          <label>
            Search claim or identifier
            <input
              type="search"
              value={query}
              placeholder="What is missing?"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Lifecycle
            <select
              aria-label="Lifecycle"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All states</option>
              {Array.from(new Set(gaps.map((g) => g.gap.status)))
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              aria-label="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="deadline">Deadline · earliest</option>
              <option value="budget">Budget · highest</option>
              <option value="sources">Sources · most</option>
            </select>
          </label>
        </div>
      )}
      <p className="eyebrow register-count" role="status">
        {visible.length} {visible.length === 1 ? "dossier" : "dossiers"} in this view
      </p>
      <div className="register-head" aria-hidden="true">
        <span>Claim / dossier</span>
        <span>Budget · USDC</span>
        <span>Lifecycle / sources</span>
        <span>Deadline</span>
      </div>
      {visible.map(({ gap, runtime, submissionCount }, i) => (
        <article className="register-row" key={gap.id}>
          <div className="register-claim">
            <span className="mono muted">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <Link href={`/gaps/${gap.id}`}>
                <h3>
                  {gap.claim} <span aria-hidden="true">↗</span>
                </h3>
              </Link>
              <span className="mono muted identifier">{gap.id}</span>
            </div>
          </div>
          <div>
            <small>Budget / USDC</small>
            <strong className="money">{fmtUsdc(gap.budgetUnits)}</strong>
          </div>
          <div>
            <span className={`status ${gap.status}`}>{gap.status}</span>
            <p>
              {submissionCount} sources · {runtime.network ?? "network unknown"}
            </p>
            <small>{runtime.fundTxHash ? "Funding recorded" : "No funding record"}</small>
          </div>
          <div>
            <small>Deadline</small>
            <time dateTime={gap.deadline}>{utcDate(gap.deadline)}</time>
          </div>
        </article>
      ))}
      {!visible.length && (
        <div className="empty-market">
          <span className="empty-glyph" aria-hidden="true">
            [ ? ]
          </span>
          <div>
            <h3>
              {gaps.length
                ? "No matching dossiers."
                : "The next question is still unwritten."}
            </h3>
            <p>
              {gaps.length
                ? "Try another claim or clear the lifecycle filter."
                : "No bounties in this environment. Explore an explicitly simulated case in the lab."}
            </p>
          </div>
          {gaps.length ? (
            <button
              className="btn"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link className="btn" href="/lab">
              Explore the lab ↗
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
