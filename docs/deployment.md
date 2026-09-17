# Deployment

## Environments

| | local | testnet | mainnet |
| --- | --- | --- | --- |
| `GAP402_NETWORK` | `local` | `testnet` | `mainnet` |
| chain | arc-anvil `31337` | `5042002` | `5042` |
| extra gate | — | — | `MAINNET_ENABLED=true` |

## Local (arc-anvil)

```bash
arc-anvil --network arc --port 8545   # USDC interface live at 0x3600…0000
pnpm install
pnpm deploy                           # writes deployments/local.json
```

`deploy.ts` deploys `GapBounty` (which deploys its own
`EvidenceReceiptRegistry`) using anvil account #0 when `PRIVATE_KEY` is
unset. USDC is the canonical Arc interface address — no mock token needed
under `arc-anvil --network arc`.

Then run the stack:

```bash
GAP_BOUNTY_ADDRESS=$(jq -r .gapBounty deployments/local.json) \
PRIVATE_KEY=0xac0974…ff80 \
VERIFIER_PRIVATE_KEY=0x59c699…690d \
pnpm --filter @gap402/api start
pnpm --filter @gap402/web dev
```

## Testnet

```bash
# fund the deployer from https://faucet.circle.com
GAP402_NETWORK=testnet PRIVATE_KEY=0x… pnpm deploy
```

## Mainnet — fail-closed by design

```bash
MAINNET_ENABLED=true GAP402_NETWORK=mainnet PRIVATE_KEY=0x… pnpm deploy
```

The script refuses unless: `MAINNET_ENABLED=true`, the RPC chain id is
exactly `5042`, `PRIVATE_KEY` is set (never printed), and the deploy tx is
confirmed. Output lands in `deployments/mainnet.json` with explorer URLs.

### Controlled mainnet demo

```bash
MAINNET_ENABLED=true DEMO_CONFIRM=YES DEMO_MAX_USDC=0.10 \
  PRIVATE_KEY=0x… VERIFIER_PRIVATE_KEY=0x… \
  GAP_BOUNTY_ADDRESS=0x… \
  DEMO_QUESTION="…" DEMO_CLAIM="…" \
  DEMO_SOURCE_URLS="https://…,https://…" \
  pnpm demo:mainnet
```

Safeguards: explicit `DEMO_CONFIRM=YES`, spend cap `DEMO_MAX_USDC`
(default 0.10 USDC), balance check, chain-id assertion, real fetched
sources only (no fixtures on mainnet), and per-step explorer links.

## Contract verification

```bash
cd contracts
arc-forge verify-contract <address> src/GapBounty.sol:GapBounty \
  --network arc   # see docs.arc.io for current verifier flags
```

## Current deployment status

| network | GapBounty | ReceiptRegistry | status |
| --- | --- | --- | --- |
| mainnet | — | — | **not deployed** — requires funded key + explicit run |
| testnet | — | — | not deployed |
| local | per-run | per-run | `pnpm demo` deploys fresh each run |
