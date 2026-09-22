# Security model and review notes

Also see the repository-level [SECURITY.md](../SECURITY.md) for reporting.

## Trust model

| actor | can do | cannot do |
| --- | --- | --- |
| requester | create/fund bounty, cancel after deadline | touch escrow after funding except via contract paths |
| supplier | submit evidence, commit hashes | withdraw escrow, finalize, claim twice for one address |
| verifier | finalize (only address allowed) | finalize twice, overdraw escrow, pay zero-addr/amounts, self-deal beyond the configured fee share |
| API operator | censor submissions (availability risk) | move funds — only the contract does that |

## Threats and controls

**Contract-level**

- *Reentrancy* — `finalize`/`cancel` zero state before external calls
  (checks-effects-interactions) plus a reentrancy lock.
- *Double settlement* — state transition `Funded -> Settled` is one-way;
  second call reverts (`BountyNotFunded`).
- *Duplicate payout lines* — the API aggregates per recipient; the contract
  additionally requires strictly increasing addresses, making duplicates
  impossible onchain.
- *Malformed allocation* — contract reverts on empty payouts, zero
  recipients/amounts, `sum > escrow`, unsorted recipients. Residue refunds
  to requester.
- *Zero-hash anchoring* — `settlementHash`/`receiptHash` must be non-zero.
- *Premature cancel* — `cancel` requires `block.timestamp > deadline`.
- *Deadline/cap gaming* — `commitEvidence` reverts after deadline and at
  `maxCommitments`; duplicate `evidenceHash` reverts.
- *Blocklisted/odd ERC-20s* — `SafeTransferLib` checks returndata; Arc USDC
  transfers can revert for sanctioned addresses, which simply fails the tx.

**Accounting**

- All money is `bigint` 6-decimal base units; no floats anywhere.
- Settlement re-verifies `sum(payouts) + refund == bounty` before returning
  and the contract re-verifies `sum(amounts) <= escrow` onchain.
- Allocation is deterministic — same inputs, same bytes, same hash.

**Evidence/verifier**

- *Prompt injection* — retrieved titles/excerpts pass through
  `sanitizeForPrompt` (control-char strip, instruction-marker neutralizing,
  length cap) before reaching any LLM. Evidence is data, never instructions.
- *Duplicate farming / Sybil* — canonical-URL dedup at the store level
  (unique index), content-hash dedup in evaluation, and per-recipient
  aggregation mean ten sybil submissions share one payout line.
- *URL mutation* — `canonicalizeUrl` strips tracking params and fragments;
  `contentHash` commits to retrieved bytes.
- *LLM manipulation* — semantic scoring is optional and labeled; verdicts
  must also pass all deterministic checks. Evaluation records are
  replayable for audit.
- *Verifier dishonesty* — out of scope for the contract (it only enforces
  exact accounting). Mitigations: pluggable verifier address per bounty,
  deterministic checks that bound worst-case mis-scoring, onchain
  transparency of the payout vector.

**Operational**

- *Private keys* — never logged, never committed; server keys come from env.
  `.env*` is gitignored; only `.env.example` is tracked.
- *Network confusion* — `verifyNetwork()` runs before every tx; mainnet
  requires `MAINNET_ENABLED=true`; RPC URLs validated http(s).
- *Mainnet demo* — `demo-mainnet.ts` refuses without `DEMO_CONFIRM=YES`,
  enforces `DEMO_MAX_USDC`, checks balance first, verifies chain id.
- *Dependency risk* — build allowlist (`onlyBuiltDependencies`) for native
  modules; lockfile committed.

## Known limitations (honest list)

- The verifier is a single trusted party per bounty in v1.
- `arc-anvil --network arc` emulates mainnet; edge behaviors (blocklist
  gas consumption, system-transaction quirks) need a real testnet/mainnet
  pass before significant value.
- `balanceOf` truncation at the 6/18-decimal seam is documented; Gap402
  never routes sub-micro-USDC amounts.
- The API is single-process; concurrent finalize is guarded by status
  checks but not by distributed locking.
- Evidence content is fetched by suppliers, not crawled by the platform —
  a fabricated URL is only caught by verifier heuristics/semantics.
# Product verification boundaries (September 2026)

`/api/gaps/:id/proof` exports request + plan + receipt. `verifyBundle` verifies
canonical commitments, exact bigint accounting, recipients and bounty binding.
It does not fetch evidence or query a registry. Rehashing an entirely forged
bundle can pass; compare with a trusted onchain anchor for authenticity.

The verifier checks declared metadata and sanitized excerpts. `url_format` is
syntax validation, not evidence of successful retrieval. Source ownership and
editorial independence are not authenticated. `minIndependentSources` counts
accepted root-domain heuristics before building a settlement plan. The existing
last-two-label heuristic is not a full public-suffix or ownership analysis.

Buyer budgets are reserved before asynchronous creation and retain reservations
on ambiguous failures. The cap is per buyer instance, not persistent across
restarts. Reconcile chain state before retrying. A refund is credited only after
receipt integrity, request binding and exact budget checks pass.

For testnet/mainnet API writes set a strong `GAP402_WRITE_TOKEN`; SDK clients
receive it via `writeToken`, CLI/MCP via the environment. It is an operator
credential, never a browser/public variable. Use TLS and restrict operator access.
This is not multi-user wallet authorization. Read-only routes remain public.
`POST /api/demo` is public but uses a fresh in-memory store, fixed fixtures and
no chain client or signing keys. Rate-limit it at the hosting edge.
