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

## Evidence exchange walkthrough / current UI

1. Open `/` and introduce the dossier: “When evidence is missing, create a market
   for it.” The cover and five chapters are labeled illustrative fixtures. Select
   source 02 and follow its identity into inspection, allocation and the record.
2. Open `/lab`, choose **A useful discovery**, and **Run this experiment**.
   State that this is a completed-response replay with synthetic sources and mock
   semantic scores. Actual spend is zero; the simulated budget is 0.050000 USDC.
3. Move to **Source inspection**. Select source 02 by mouse or keyboard. Open its
   five evaluation scores and identity disclosure. Select the stale rumor to show
   the returned rejection. Point out that the tracking-link repost was prevented
   from becoming another submission, rather than showing it as a paid fourth row.
4. Move to **Allocation**. The selected source stays identifiable. Read the actual
   returned amount and allocation explanation; do not narrate fixed sample payout
   amounts. Select the verifier fee and refund. Supplier amounts + fee + refund
   reconcile exactly; the fee already belongs to the plan's payout rows.
5. Move to **Portable receipt**, follow the inspector link, and **Verify in browser**.
   Download the original bundle. Edit a payout; stale verification disappears.
   Verify again to show tamper failure. These checks establish consistency, not
   factual truth or independent registry authentication.
6. Switch to **Almost enough** and run. The unmet domain requirement stops
   allocation: no plan and no receipt. Then run **Nothing holds up**: no supplier
   earns a payout, while the verifier fee and refund are explicitly accounted for.
7. Return to the market register and receipt archive. Only actual API records are
   shown. A missing funding/settlement transaction is never inferred from a
   lifecycle label. On an empty environment, use the lab rather than inventing
   market activity. Replay and restart reuse the completed response without spending
   or sending extra requests.

The review screenshot set uses a loopback-only fixture adapter. It is not the
public market and must not be narrated as real supplier activity. See
[frontend-design.md](frontend-design.md) for the visual system, route captures,
production review commands and exact validation findings.
