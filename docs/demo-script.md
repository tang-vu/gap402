# Demo script — ~90 seconds

Target: a judge watching the local demo (`pnpm demo`) or a narrated
screen recording of the web UI against the same run.

**0–10s — the question**

> "A research agent gets a question it can't fully support: *Has Acme Corp
> actually deployed WidgetNet in Vietnam?*"

**10–20s — evidence gap detected**

> "It scans its sources. Coverage comes back at 14% — one aggregator rumor,
> nothing independent, nothing official. The agent flags the exact
> unsupported claim and its acceptance criteria: fresh, resolvable,
> non-duplicate, independently sourced."

**20–30s — the market is created**

> "Instead of guessing, the agent does something new — it turns the gap into
> a market. A 0.05 USDC bounty, escrowed on Arc. Here's the funding
> transaction."

*(show fund tx hash / explorer link)*

**30–45s — suppliers compete**

> "Three independent supplier agents discover the bounty. A generalist, an
> official-source specialist, and an independent-press specialist each decide
> whether it's worth their search budget, then submit candidate evidence —
> including a repost that gets deduplicated and an unrelated page."

**45–60s — verification**

> "The verifier runs deterministic checks — URL canonicalization, freshness,
> source type, duplicates — and scores each survivor on support, provenance,
> independence, novelty, freshness. One submission is rejected outright."

**60–70s — portfolio settlement**

> "Not winner-take-all. The bounty splits by measured quality: 0.0279 to the
> independent report, 0.0196 to the official source, a verifier fee, zero
> residue. The sum reconciles to the wei — check the invariant line."

**70–80s — cryptographic receipt**

> "The Evidence Receipt is hashed and anchored onchain. Anyone can run
> `gap402 receipt verify` and confirm it — no trust in this API required."

**80–90s — the agent finishes**

> "Coverage jumps 14% to 79%. The agent folds the new evidence into its
> answer and continues — it bought the missing proof."

**Optional +10s — unanswered bounties don't burn**

> "And if no one can answer? The deadline passes, the gap expires, and the
> requester reclaims the escrow onchain — watch the balance come back.
> Markets that fail still fail closed."

**Final card**

> "The agent couldn't find the answer. So it created a market for one."

## Recording notes

- Run `pnpm demo` — it prints every stage with real tx hashes.
- Keep `pnpm --filter @gap402/web dev` open on `/gaps/<id>` to show the
  lifecycle timeline, evidence graph, and settlement graph live.
- The banner reads **LOCAL** under arc-anvil; a mainnet recording shows
  **ARC MAINNET** with live explorer links.
# Interactive reviewer path

Start `pnpm dev`, open `/lab`, and state that the walkthrough uses synthetic
sources, a mock verifier and no blockchain spending. Choose the mixed scenario.
Show the unsupported claim, fixed 0.05 USDC simulated budget, two useful sources,
rejected stale rumor, and tracking-link duplicate. Show recipient payouts,
verifier fee and refund. The sum is exact; it is not a business revenue metric.

Click **Verify in browser**, download JSON, then change a payout and verify
again. Explain that consistency checks are separate from registry authenticity
and factual truth. Run **Insufficient independent sources**: the agent refuses
settlement. Run **All evidence rejected**: no supplier earns a payout, the
verifier fee is visible and the agent abstains.

Then show `pnpm demo` for actual escrow, settlement, registry anchor and deadline
reclaim transactions on **local Arc emulation**. Sources remain fixtures.
For a grant submission replace the local transaction evidence with an actual
mainnet deployment and receipt, using the guarded mainnet runbook. Do not show
the Lab's zero-spend result as a mainnet payment.
