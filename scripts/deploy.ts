import { writeFileSync } from "node:fs";
import { Gap402Chain } from "@gap402/sdk";
import { resolveNetwork, parseNetworkName, ConfigError } from "@gap402/config";

/**
 * Deploy GapBounty (+ its EvidenceReceiptRegistry) to the resolved network.
 *
 *   pnpm deploy                          # local (arc-anvil), anvil default key
 *   GAP402_NETWORK=testnet pnpm deploy   # testnet, PRIVATE_KEY required
 *   GAP402_NETWORK=mainnet MAINNET_ENABLED=true PRIVATE_KEY=0x… pnpm deploy
 *
 * Writes deployments/<network>.json with the addresses + deploy tx.
 * Never prints or persists private keys.
 */

const ANVIL_KEY_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

async function main() {
  const name = process.env.GAP402_NETWORK ?? "local";
  const network = resolveNetwork(parseNetworkName(name));
  const privateKey = (process.env.PRIVATE_KEY ??
    (network.name === "local" ? ANVIL_KEY_0 : undefined)) as `0x${string}` | undefined;
  if (!privateKey) {
    throw new ConfigError(`PRIVATE_KEY required for ${network.name} deployment`);
  }

  const chain = new Gap402Chain(network);
  await chain.verifyNetwork();
  console.log(`deploying to ${network.name} (chainId ${network.chainId})`);

  // On Arc, USDC is the canonical ERC-20 interface address; arc-anvil
  // emulates it so local mode uses the same address as production.
  const { usdc, bounty, registry } = await chain.deployContracts(privateKey, {
    deployMockUsdc: false,
  });

  const out = {
    network: network.name,
    chainId: network.chainId,
    usdc,
    gapBounty: bounty,
    receiptRegistry: registry,
    deployedAt: new Date().toISOString(),
    explorer: network.explorerUrl
      ? {
          gapBounty: `${network.explorerUrl}/address/${bounty}`,
          receiptRegistry: `${network.explorerUrl}/address/${registry}`,
        }
      : null,
  };
  const file = `deployments/${network.name}.json`;
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
