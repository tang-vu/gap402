# gap402 contracts

Two small, immutable contracts. AI evaluation stays offchain; the contracts
provide escrow integrity and durable receipts.

| Contract | Role |
| --- | --- |
| `src/GapBounty.sol` | USDC escrow for evidence bounties: create, commit evidence hashes, verifier-only finalize with exact-sum payouts, deadline refund. Deploys its receipt registry in the constructor. |
| `src/EvidenceReceiptRegistry.sol` | Anchors `receiptHash` values; only the bound `GapBounty` can write. |
| `src/test/MockUSDC.sol` | Test-only ERC-20 stand-in (not deployed). |

## Toolchain

Built with **Arc Foundry** (`arc-forge` / `arc-anvil` / `arc-cast`), the Arc
distribution of Foundry. `lib/forge-std` is vendored so the tree builds
reproducibly without a submodule fetch.

```shell
# run the suite against the Arc profile (chain id, USDC semantics)
arc-forge test --network arc -vvv

# local node emulating Arc, incl. the USDC ERC-20 interface at
# 0x3600000000000000000000000000000000000000 (decimals() = 6)
arc-anvil --network arc
```

## Invariants under test

- escrow cannot be overdrawn; `sum(payouts) + refund == escrow` (fuzzed)
- a bounty settles exactly once; settled/cancelled state is terminal
- only the per-bounty verifier can finalize; only the requester can cancel
- recipients must be sorted, non-zero, non-empty; payout overflow reverts
- commitments are capped and rejected after deadline; duplicates rejected
- receipt hashes anchor only through the bound bounty contract
