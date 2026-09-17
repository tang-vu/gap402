# Arc Microgrants submission — Gap402

**Project:** Gap402
**One-liner:** Gap402 turns unresolved AI knowledge gaps into USDC-funded
evidence markets on Arc.

## What it does

When an AI agent cannot find enough evidence for a claim, Gap402 lets it
create a structured bounty: the claim, acceptance criteria, a deadline, and
a USDC budget escrowed on Arc. Independent supplier agents discover the gap,
submit evidence, a verifier evaluates it, and a deterministic *evidence
portfolio* settlement splits the bounty across useful submissions —
producing a cryptographic Evidence Receipt anchored onchain that anyone can
independently verify.

It is agent-native infrastructure: TypeScript SDK, REST API, CLI, MCP
server, and a market UI — with contracts and settlement that are small,
immutable, and exact.

## Why Arc

- **USDC is native** — the bounty, gas, and payouts are one asset. The
  ERC-20 interface at `0x3600…0000` is shared with the native balance, so
  escrow accounting is direct and explorer-legible.
- **Real money for real evidence** — sub-dollar bounties with deterministic
  multi-party splits are only practical where fees are low and USDC is
  first-class.
- **`arc-anvil --network arc` fidelity** — the whole demo runs locally
  against faithful USDC emulation before touching mainnet.

## What is deployed

- Contracts: `GapBounty` + `EvidenceReceiptRegistry` (23 Foundry tests,
  fuzz-covered, no proxies/admin keys).
- Status: **verified running end-to-end on `arc-anvil --network arc`**
  (local emulation of mainnet USDC semantics). Mainnet deployment is
  gated behind documented, fail-closed scripts — see
  [deployment.md](deployment.md). *(Update this section with the mainnet
  contract address + tx hashes after `pnpm deploy` runs against mainnet.)*

## Repo

`github.com/tang-vu/gap402` — pnpm monorepo: contracts, settlement
allocator, verifier, SDK, API+SQLite, CLI, MCP server, Next.js UI,
autonomous buyer/supplier agents, deterministic `pnpm demo`.

## Example receipt

```json
{
  "protocol": "gap402", "version": "1",
  "targetClaim": "Acme Corp deployed WidgetNet in Vietnam before 2026-09-01",
  "acceptedEvidence": [ { "url": "…", "payoutUnits": "27886" } ],
  "receiptHash": "0x…",
  "network": "local"
}
```

*(Mainnet receipt example goes here after the first live settlement.)*

## Independence

Gap402 is a standalone protocol. Keryx is a *reference consumer only* —
`examples/keryx-adapter` shows the integration surface; nothing in Gap402
imports or depends on Keryx.

## Future potential

- Multi-claim bundles and partial-coverage pricing
- Verifier reputation + ERC-8004 supplier identity
- x402-style per-call evidence sales alongside bounty markets
- A public index of resolved knowledge gaps — the market learns what the
  world cannot yet prove

## Honest notes

- Demo evidence sources are labelled fixtures; real web sourcing works via
  the `SourceProvider` seam and `DEMO_SOURCE_URLS` on mainnet.
- The verifier is trusted for *judgment* in v1; the contract enforces
  *accounting* exactly.
