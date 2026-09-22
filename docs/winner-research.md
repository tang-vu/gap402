# From hackathon evidence to Gap402 product changes

Research date: **2026-09-22**. Baseline: `adbc7ac`. This is a cross-team review,
not a history of the builder's own awards. Five external projects across three
hackathons are the primary sample; Keryx is an additional reference consumer.

## Method and confidence

Award claims below use organizer announcements or ETHGlobal's award records.
Project descriptions are team claims until supported by repository inspection.
We read implementation files where accessible, and attempted public demo links.
We did **not** execute third-party payment transactions, rerun their test suites,
or infer that their current code is identical to their hackathon submission.
No project-specific judge scoring sheets were available. “Strength” and
“application” are our engineering inferences, **not confirmed reasons for winning**.

## Current program, not the general Circle grant

[Arc Microgrants announcement](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
requires a working **mainnet** deployment with an openable link, a public repo,
a short description explaining Arc's role, and a public builder profile.
It lists twenty 500-USDC awards, rolling review, an October 14, 2026 23:59 ET
submission cutoff, and decisions by October 21. Testnet-only builds, mockups,
and work already funded by Circle/Arc are excluded. Criteria are Arc relevance,
technical credibility, build quality, and potential. Recheck before submitting.
These are separate from the roadmap/milestone-oriented
[Circle Developer Grants](https://www.circle.com/grant).

Gap402 had no deployment manifest or configured mainnet signer in this work
session. A better local demo does not remove that eligibility blocker. Do not
claim adoption or funding readiness from test counts. Prior funding eligibility
must be evaluated for **this work**; another project's award does not establish it.

## Comparison and decisions

P0 = implemented correctness boundary; P1 = implemented review/product experience.
“Expected value” is a hypothesis, not a measured usage/conversion improvement.

| Project | Hackathon and award | Verification source | Concrete strength | Application in Gap402 | Expected value | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Liminal x402 | Berlin Agentic Commerce x402, 2026; existing infrastructure, 1st | [Organizer](https://algorand.co/blog/agentic-commerce-x402-hackathon-berlin-recap), [repo](https://github.com/liminalshruti/algorand-berlin-2026) | Quote-versus-payment comparison makes an agent failure visible | Bind receipt payouts to the original specification and plan; demonstrate refusal and tampering | Reviewer can reproduce a concrete failure, rather than trust “verified” | P0 |
| SPM | Same Berlin event; new agentic commerce, 3rd | [Organizer](https://algorand.co/blog/agentic-commerce-x402-hackathon-berlin-recap), [repo](https://github.com/TriplEight/SPM) | Version-specific attestations, offline checks, payment caps enforced before signing | Portable proof export; browser/CLI validation; enforce buyer auto-pay cap and concurrent reservations | Auditable money and evidence boundaries | P0 |
| NanoCrawl | ETHGlobal Cannes 2026; Arc chain-abstracted USDC, 1st | [Award + build description](https://ethglobal.com/showcase/nanocrawl-egxyi), [integration code](https://github.com/nanocrawl-xyz/landing/blob/main/proxy.ts) | Small integration surface inside an existing agent workflow | Add proof retrieval to the existing SDK and MCP, rather than introduce a second market protocol | An agent can inspect the same proof as a human reviewer | P1 |
| Onda | ETHGlobal Cannes 2026; Arc advanced stablecoin contracts, 1st | [Award](https://ethglobal.com/showcase/onda-q1we4), [contract](https://github.com/ondaprotocol/onda/blob/main/contracts/src/PatronEscrow.sol) | Familiar user action leads directly to a visible recipient payment | Evidence Lab: one action exposes claim, acceptance, recipient payout, fee, refund, and next agent decision | Lower explanation/setup burden without hiding economics | P1 |
| WeAi | Agentic Ethereum 2025; Coinbase AgentKit pool and EigenLayer Eigen Agents pool awards (not overall first) | [Awards](https://ethglobal.com/showcase/weai-4ws59), [operator implementation](https://github.com/Agentopians/WeAi/blob/main/prompt_operator.py) | Policy verification gates the downstream agent action | Enforce minimum independent domains before planning settlement; verify receipt before refunding the buyer's budget | A declared policy becomes an actual execution boundary | P0 |
| Keryx (additional reference) | Lepton Agents / Lepton × Arc; 1st per user and builder profile; direct organizer post not independently recovered | [Builder profile](https://tangvu.dev/), [repo](https://github.com/tang-vu/keryx) | Visible research decisions, exact versions, portable receipts | Explain accepted/rejected evidence, expose receipt provider, label simulated runs and show before/after decisions | More inspectable research outcome | P1 |

## What code review changed about the conclusions

**Liminal:** [validation.ts](https://github.com/liminalshruti/algorand-berlin-2026/blob/main/apps/router/src/validation.ts)
compares settled and quoted amounts and leaves `output_pass` null. Its
[route tests](https://github.com/liminalshruti/algorand-berlin-2026/blob/main/apps/router/src/routes.validation.test.ts)
exercise honest/cheating providers and anchor failure. This supports a narrow
price-integrity claim, not universal verification of agent output. We adapt the
explicit comparison principle using bigint; we do not import its floating-point
tolerance or describe a hash as evidence that a claim is true.

**SPM:** [donor.ts](https://github.com/TriplEight/SPM/blob/master/mcp/src/donor.ts)
filters payment requirements against an asset and amount cap before creating
signatures, with explicit donation opt-in. The repository documents offline
attestation verification and openly states deployment limitations. This led to
two concrete fixes: enforce Gap402's unused auto-payment threshold and reserve
budget before asynchronous funding. An ambiguous timeout retains the reservation;
operators must reconcile it instead of retrying blindly. Gap402's policy remains
per buyer instance, not a durable wallet-wide authorization system.

**NanoCrawl:** the inspected `proxy.ts` is an SDK integration with route prices
and free routes. It confirms the small integration seam, not the entirety of the
MCP/privacy/payment implementation claimed by the showcase. The live demo link
could not be fetched in this session. Gap402 already has an SDK and MCP, so the
useful extension is a proof tool on those surfaces. Privacy pools, multichain
withdrawal, and per-page x402 charging are excluded: they solve a different
purchase flow and would not strengthen the missing-evidence bounty mechanism.

**Onda:** inspected `PatronEscrow.sol` routes signed tips directly or into
unclaimed balances, with nonces and an owner-mediated release. The repo README
says Cannes 2025 while ETHGlobal and Circle identify Cannes 2026; the table uses
the organizers' date and preserves this discrepancy. The public demo could not
be fetched. We adopt clear action-to-recipient economics, not artist identity,
session wallets, or an owner-operated claim system.

**WeAi:** `prompt_operator.py` checks prompt length and keyword presence before
signing a verdict. The showcase explicitly labels simulated operators. The
lesson is an executable policy gate and honest scope, not that a decentralized
oracle proves semantic correctness. Gap402 keeps its trusted verifier and
documents domain independence as a heuristic, not independent ownership proof.

**Keryx:** the repository distinguishes portable receipt self-checks from
publisher/onchain signatures. Gap402's existing adapter remains standalone.
The new proof bundle retains that distinction. We did not copy Keryx's product,
claim its users or payments, or reuse its award as evidence of Gap402 traction.

## Gap402 baseline and integrated result

Inspected API/SQLite service, schemas, protocol hashes, verifier, portfolio
allocator, SDK/chain client, buyer/supplier examples, MCP, CLI, Next.js market and
receipt pages, deployment/demo scripts, contract tests, and recent git history.
Recent commits added deadline reclaim to contracts/demo/SDK/MCP. These capabilities
are retained rather than rebuilt. The distinguishing mechanism remains a
**demand-led evidence bounty with a portfolio payout**, not payment per API call.

| Before | Implemented result | How to inspect |
| --- | --- | --- |
| Read-only market; CLI needed to understand the full story | Isolated interactive walk-through using the real service/verifier/allocator | `/lab`, three scenarios, no wallet or persistent market writes |
| Receipt hash and internal sums checked in CLI | Original request, plan and receipt exported together; hash, recipient, fee, uniqueness, binding and exact-budget checks | `/verify`, receipt page, `proof-export`, `proof-verify`, MCP proof tool |
| Auto-pay threshold declared but unused; concurrent calls could oversubscribe | Threshold and positive budget enforced; reservation precedes funding await | Buyer regression tests |
| Minimum source count declared but not enforced | Insufficient accepted domain diversity refuses plan creation | Lab's insufficient-sources case, API 409 |
| Requirements could override the claim being evaluated | Acceptance claim pinned to the target claim | Service regression test |
| Full content could be ignored in favor of excerpt hash | Full content takes precedence; supplied full-content/hash mismatch refused | Service test; content still not stored |
| Mock provider omitted from receipt version; URL check called “resolvable” | Actual evaluator version retained; check explicitly says syntax only | Receipt and individual evaluation checks |
| Network label could imply a real settlement with no chain configuration | Offchain labels per bounty/receipt; unknown network when API offline; non-local writes require auth and chain configuration | Banner, health API, deployment tests |

All selected P0/P1 principles above are implemented, not moved to a backlog.
Existing escrow, refund, MCP and deterministic allocation already cover parts of
the references; those are reused. No new chain, token, reputation network, or
x402 billing product is justified by this comparison.

## Remaining boundaries

Public mainnet deployment and a real source-to-settlement receipt are still
required for the microgrant. RPC availability, funded signers, a configured
semantic provider and a hosting destination are external dependencies.
The evidence verifier evaluates sanitized supplier excerpts/metadata; it does not
authenticate publishers or fetch pages independently. Hash-only evidence does
not prove facts. Domain diversity uses the existing last-two-label heuristic,
not a public-suffix database or proof of separate ownership. Offline bundle
validation proves internal consistency; a fully rewritten self-consistent
bundle needs comparison with a trusted registry anchor. The demo has no real
users, revenue, adoption figures or guaranteed grant outcome.
