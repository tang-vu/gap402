# Arc Microgrants submission — Gap402

**Project:** Gap402
**One-liner:** Gap402 turns unresolved AI knowledge gaps into USDC-funded
evidence markets on Arc.

## Eligibility checked September 24, 2026

[Current Arc Microgrants rules](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
require a working mainnet deployment and an openable link, public repository,
short Arc-use description, and builder profile. Deadline: October 14, 2026,
23:59 ET; reviews are rolling. The mainnet deployment and settlement below are
confirmed. This document remains **draft submission copy** until the builder
confirms that this project has not already received Circle/Arc funding.

## Reviewable product improvements

- `/lab`: three isolated, zero-spend scenarios using the production domain engine;
  synthetic sources and mock semantic scoring are prominently identified.
- Receipt pages export the original request, settlement plan and receipt.
  `/verify` checks the bundle locally in the browser; CLI and MCP provide the
  same integration surface. Offline integrity is distinct from chain anchoring.
- Automatic spending caps, independent-source minimums, and request/receipt
  binding are enforced. Non-local writes require authorization and configured
  chain funding; no silent simulation fallback.
- [Cross-team research and implementation rationale](winner-research.md)
  documents awards, source-code findings, limitations and expected value.

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
- Arc mainnet (chain `5042`): [GapBounty
  `0xadaec572036fce9b6c7b4a1e4aa979ac57c5d183`](https://explorer.arc.io/address/0xadaec572036fce9b6c7b4a1e4aa979ac57c5d183)
  and [EvidenceReceiptRegistry
  `0x89dec1F5223d8BB64a39643790115e553C24fF65`](https://explorer.arc.io/address/0x89dec1F5223d8BB64a39643790115e553C24fF65).
- [Deployment transaction](https://explorer.arc.io/tx/0x881fccde46362bc2b72f192ddcd4a787fac0da8e9cada664ed59ec6d98bf11a1),
  [0.05 USDC bounty funding](https://explorer.arc.io/tx/0xddca31454992b56dd8ac935ae6ee54e83712ef3ce92db25408880f842078c664),
  and [settlement](https://explorer.arc.io/tx/0x8a543db2c35a5cabfc1fca9b4e119cc6e4f1fac34630a13b8e7e3bd47ca786db)
  all returned successful receipts on September 24, 2026.
- Review at [the public mainnet run](https://gap402.tangvu.dev/mainnet), or
  [download the portable proof](../apps/web/public/mainnet-proof.json).

## Repo

`github.com/tang-vu/gap402` — pnpm monorepo: contracts, settlement
allocator, verifier, SDK, API+SQLite, CLI, MCP server, Next.js UI,
autonomous buyer/supplier agents, deterministic `pnpm demo`.

## Mainnet receipt summary

```json
{
  "protocol": "gap402", "version": "1",
  "targetClaim": "Arc mainnet exposes USDC at 0x3600000000000000000000000000000000000000",
  "acceptedEvidence": 2,
  "totalPaidUnits": "35750",
  "refundUnits": "14250",
  "receiptHash": "0xcc5902d07332f44a6a046157c4b42bff112b4a94d95777ea24a5fe84cf7880e3",
  "network": "mainnet"
}
```

The registry's `isAnchored(receiptHash)` returned `true` on mainnet. The
portable bundle passed all offline CLI integrity checks. The supplier payout was
0.03325 USDC, the verifier fee 0.0025 USDC, and 0.01425 USDC was refunded.

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

- The public Evidence Lab uses labelled fixtures and zero spend. The separate
  mainnet run fetched the Arc and Circle contract-address pages.
- The mainnet run used the labelled mock semantic scorer and two wallets
  controlled by the prototype operator. It proves contract funding, payout,
  accounting and receipt anchoring, not third-party demand or source truth.
- The verifier is trusted for *judgment* in v1; the contract enforces
  *accounting* exactly.

## DoraHacks submission fields

The [official submission form](https://dorahacks.io/hackathon/arc-microgrants)
asks for the following. Confirm the personal and eligibility answers with the
builder before submitting.

| Field | Answer |
| --- | --- |
| Project name | Gap402 |
| Your name, alias, or team name | tang-vu |
| Contact email | Builder to provide |
| Public builder profile | https://github.com/tang-vu |
| Live deployment on Arc mainnet | https://gap402.tangvu.dev/mainnet |
| Arc mainnet contract address or transaction hash | `0xadaec572036fce9b6c7b4a1e4aa979ac57c5d183` (settlement `0x8a543db2c35a5cabfc1fca9b4e119cc6e4f1fac34630a13b8e7e3bd47ca786db`) |
| Public repo | https://github.com/tang-vu/gap402 |
| In two sentences, what does your project do? | Gap402 lets AI agents post USDC bounties for missing evidence, then evaluates supplier submissions and splits the escrow by a deterministic settlement plan. Each resolution produces a portable Evidence Receipt whose integrity can be checked independently. |
| What does it use Arc for? | Gap402 escrows the bounty in USDC on Arc mainnet, pays the supplier and verifier, refunds the unused amount, and anchors the receipt hash in a separate registry contract. The public mainnet run links the funding and settlement transactions and the proof bundle. |
| Had you deployed to Arc before this project? | Builder to confirm: Mainnet / Testnet / No |
| Have you received a Circle or Arc grant, bounty, or prize for this project? | Builder to confirm: Yes / No |
| Anything else we should see? | The `/mainnet` page downloads the proof and links every transaction. The run fetched two real public pages but used a mock semantic scorer and operator-controlled supplier/verifier wallets; the Evidence Lab is a separate zero-spend sandbox. |
