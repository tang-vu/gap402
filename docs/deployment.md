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
| mainnet | [`0xadaec5…5d183`](https://explorer.arc.io/address/0xadaec572036fce9b6c7b4a1e4aa979ac57c5d183) | [`0x89dec1…4fF65`](https://explorer.arc.io/address/0x89dec1F5223d8BB64a39643790115e553C24fF65) | deployed 2026-09-24; [deployment tx](https://explorer.arc.io/tx/0x881fccde46362bc2b72f192ddcd4a787fac0da8e9cada664ed59ec6d98bf11a1) and [settlement tx](https://explorer.arc.io/tx/0x8a543db2c35a5cabfc1fca9b4e119cc6e4f1fac34630a13b8e7e3bd47ca786db) confirmed |
| testnet | — | — | not deployed |
| local | per-run | per-run | `pnpm demo` deploys fresh each run |
# Authenticated operator writes and public reviewer UI

Configure a strong `GAP402_WRITE_TOKEN` on the API and operator CLI/MCP process
before enabling testnet/mainnet writes. Pass `writeToken` explicitly to SDK
instances. Do not expose it in `NEXT_PUBLIC_*` or browser code. Non-local writes
without this configuration return 503; invalid authorization returns 401.
Non-local bounty creation also requires both signers and the bounty contract.
The requester address must match the funding signer. The public web UI needs
only `GAP402_API`; its Evidence Lab uses an isolated simulation endpoint.

Mainnet demo now also requires `GAP402_WRITE_TOKEN`; it forwards the credential
to its local API for all operator actions. Mainnet remains opt-in and requires
funded keys, a deployed contract, real source URLs and an appropriate verifier.
Store secrets outside Git. Expose the UI over HTTPS, leave API writes private
or authenticated, and apply edge rate limits to the public simulation endpoint.

Export a settled proof with `gap402 proof-export <gap-id> > proof.json` and run
`gap402 proof-verify proof.json` offline. Receipt pages offer browser verification
and JSON download. Check the receipt registry separately for onchain anchoring.
