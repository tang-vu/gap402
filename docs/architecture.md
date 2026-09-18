# Architecture

## Components

```text
┌─────────────────────────────── offchain ───────────────────────────────┐
│ apps/web (Next.js)        apps/api (Fastify + SQLite)                   │
│ apps/cli (gap402)         ├─ store    rows(id,kind,ref,json)            │
│ apps/mcp (stdio)          ├─ service  gap lifecycle + evaluation + plan │
│ examples/* (agents)       └─ routes   REST + explorer links             │
│         │                        │                                    │
│   @gap402/sdk              @gap402/verifier    @gap402/settlement       │
│   client + Gap402Chain     deterministic +     portfolio allocator      │
│   (viem)                   semantic provider   (bigint, deterministic)  │
│         │                        │                                    │
│   @gap402/config           @gap402/evidence    @gap402/protocol         │
│   networks, env, USDC      url canon, hash,    canonical JSON,          │
│   units, fail-closed       excerpt, sanitize   spec/settle/receipt hash │
└──────────┼─────────────────────────────────────────────────────────────┘
           │ viem (chain-id verified, 20 gwei fee floor)
┌──────────┼─────────────────── onchain (Arc) ───────────────────────────┐
│ GapBounty.sol            escrow · commitments · exact-vector finalize   │
│ EvidenceReceiptRegistry  anchored receipt hashes (bound to GapBounty)   │
│ USDC ERC-20 interface    0x3600…0000 (6 dp; shares native gas balance)  │
└────────────────────────────────────────────────────────────────────────┘
```

## Data flow (happy path)

1. **Buyer** (`AutonomousBuyer` or any SDK consumer) runs its own coverage
   estimator over a claim. Below threshold → `POST /api/gaps`.
2. **API** validates + stores the `GapRequest`, computes `specHash`, and —
   when `GAP_BOUNTY_ADDRESS` + `PRIVATE_KEY` are configured — approves and
   calls `createBounty`, persisting `chainBountyId`/`fundTxHash`.
3. **Suppliers** poll `GET /api/gaps?status=open|submissions`, run their own
   `SourceProvider` (web search, docs, fixtures for demos), and `POST
   /api/gaps/:id/submissions`. The API canonicalizes URLs, dedups by
   `(bounty, canonicalUrl)`, sanitizes untrusted text, hashes content, and
   can commit `contentHash` onchain.
4. **Verifier** (`POST /:id/evaluate`) runs deterministic checks
   (duplicates, domain lists, freshness, source-type rules, citation) then
   an optional `SemanticProvider` (mock default; OpenAI-compatible via env)
   for support/contradiction. Idempotent: already-evaluated submissions are
   not re-scored.
5. **Settlement** (`POST /:id/finalize`) builds the deterministic plan,
   constructs the receipt (hash-first), calls `GapBounty.finalize` with the
   exact payout vector + `settlementHash` + `receiptHash`, then stores the
   receipt with `settlementTx`.
6. **Buyer** polls (`waitForEvidence`), fetches the receipt, merges accepted
   evidence, recomputes coverage, continues its answer.
7. **Deadline reclaim**: reads past `deadline` mark the gap `expired`
   (lazy, in `getGap`/`listGaps`). `POST /:id/cancel` then calls
   `GapBounty.cancel` to refund escrow onchain — terminal and
   settlement-exclusive, enforced both offchain and by the contract.

## Trust boundaries

- **Untrusted input**: every supplier URL/excerpt/title. Sanitized before any
  prompt use; excerpts capped at 2 KB; content never stored whole.
- **Verifier is trusted** to evaluate honestly — it alone can finalize. The
  contract enforces *accounting* correctness, not truthfulness. Semantic
  scores stay offchain; only commitments and the settlement vector are
  anchored. Dishonest verification is a governance problem (pluggable
  verifiers, reputation — roadmap), not an accounting one.
- **API is not the source of truth for money**: chain state is. UI renders
  stored projections but explorer links and `receipt verify` check the
  chain directly.

## Why this shape

- **Small immutable contracts** — two contracts, no proxies, no admin keys.
  The bug surface is accounting, which is fully specified and fuzz-tested.
- **AI offchain** — model scores are heuristic judgments; anchoring them
  as "truth" would be dishonest. The chain enforces *economic* integrity.
- **SQLite now, Postgres later** — `Store` is a 3-method JSON-row
  interface; the swap is a rewrite of one file, not the API.
- **Everything replayable** — canonical JSON + content hashing means a
  third party can recompute every hash in the system.
