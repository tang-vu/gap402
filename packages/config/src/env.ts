import {
  arcLocal,
  arcMainnet,
  arcTestnet,
  USDC_ERC20_ADDRESS,
  USDC_DECIMALS,
  type NetworkConfig,
  type NetworkName,
} from "./networks.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function env(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

/**
 * Resolve the active network from GAP402_NETWORK (local|testnet|mainnet).
 * Fails closed: mainnet requires MAINNET_ENABLED=true, and all RPC URLs are
 * validated to be http(s).
 */
export function resolveNetwork(
  name?: NetworkName,
  overrides: { rpcUrl?: string; explorerUrl?: string | null } = {},
): NetworkConfig {
  const network = name ?? parseNetworkName(env("GAP402_NETWORK") ?? "local");

  if (network === "mainnet" && env("MAINNET_ENABLED") !== "true") {
    throw new ConfigError(
      "GAP402_NETWORK=mainnet requires MAINNET_ENABLED=true. Refusing to configure mainnet without an explicit opt-in.",
    );
  }

  const base: NetworkConfig =
    network === "mainnet"
      ? {
          name: "mainnet",
          chain: arcMainnet,
          chainId: arcMainnet.id,
          rpcUrl: env("ARC_MAINNET_RPC_URL") ?? "https://rpc.mainnet.arc.io",
          explorerUrl: env("ARC_MAINNET_EXPLORER") ?? "https://explorer.arc.io",
          usdcAddress: (env("USDC_ADDRESS") ?? USDC_ERC20_ADDRESS) as `0x${string}`,
          usdcDecimals: USDC_DECIMALS,
          isMainnet: true,
        }
      : network === "testnet"
        ? {
            name: "testnet",
            chain: arcTestnet,
            chainId: arcTestnet.id,
            rpcUrl: env("ARC_TESTNET_RPC_URL") ?? "https://rpc.testnet.arc.io",
            explorerUrl: env("ARC_TESTNET_EXPLORER") ?? "https://explorer.testnet.arc.io",
            usdcAddress: (env("USDC_ADDRESS") ?? USDC_ERC20_ADDRESS) as `0x${string}`,
            usdcDecimals: USDC_DECIMALS,
            isMainnet: false,
          }
        : {
            name: "local",
            chain: arcLocal,
            chainId: arcLocal.id,
            rpcUrl: env("LOCAL_RPC_URL") ?? "http://127.0.0.1:8545",
            explorerUrl: env("LOCAL_EXPLORER_URL") ?? null,
            // Local mode deploys a MockUSDC; the canonical address is only a
            // placeholder until deploy.ts writes the real one to env/file.
            usdcAddress: (env("USDC_ADDRESS") ?? USDC_ERC20_ADDRESS) as `0x${string}`,
            usdcDecimals: USDC_DECIMALS,
            isMainnet: false,
          };

  const cfg: NetworkConfig = { ...base };
  if (overrides.rpcUrl !== undefined) cfg.rpcUrl = overrides.rpcUrl;
  if (overrides.explorerUrl !== undefined) cfg.explorerUrl = overrides.explorerUrl;

  if (!/^https?:\/\//.test(cfg.rpcUrl)) {
    throw new ConfigError(`Invalid RPC URL for ${network}: ${cfg.rpcUrl}`);
  }
  return cfg;
}

export function parseNetworkName(raw: string): NetworkName {
  if (raw === "local" || raw === "testnet" || raw === "mainnet") return raw;
  throw new ConfigError(
    `Unknown GAP402_NETWORK "${raw}". Expected local | testnet | mainnet.`,
  );
}

/**
 * Verify a connected chain actually matches the configured network.
 * Call before sending any transaction. Fails loudly on mismatch so a demo
 * pointed at mainnet can never silently land on testnet (or vice versa).
 */
export function assertChainId(expected: NetworkConfig, actualChainId: number): void {
  if (actualChainId !== expected.chainId) {
    throw new ConfigError(
      `Chain ID mismatch: configured ${expected.name} (chainId ${expected.chainId}) ` +
        `but RPC reports chainId ${actualChainId}. Refusing to continue.`,
    );
  }
}

/** Parse a USDC decimal string ("0.05") into 6-decimal base units. */
export function parseUsdcAmount(value: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new ConfigError(`Invalid USDC amount "${value}"`);
  }
  const [whole, frac = ""] = value.split(".") as [string, string];
  if (frac.length > USDC_DECIMALS) {
    throw new ConfigError(`USDC amount "${value}" exceeds ${USDC_DECIMALS} decimals`);
  }
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded);
}

/** Format 6-decimal base units to a fixed 6dp string ("50000" -> "0.050000"). */
export function formatUsdcAmount(units: bigint): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const whole = abs / 10n ** BigInt(USDC_DECIMALS);
  const frac = (abs % 10n ** BigInt(USDC_DECIMALS))
    .toString()
    .padStart(USDC_DECIMALS, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}
