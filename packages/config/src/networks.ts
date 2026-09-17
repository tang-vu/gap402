import { defineChain } from "viem";

/**
 * Arc network definitions.
 *
 * Verified against https://docs.arc.io on 2026-09-17 (mainnet launch 2026-09-16):
 *  - Mainnet chain ID 5042 (0x13b2), RPC https://rpc.mainnet.arc.io,
 *    explorer https://explorer.arc.io
 *  - Testnet chain ID 5042002 (0x4cef52), RPC https://rpc.testnet.arc.io,
 *    explorer https://explorer.testnet.arc.io
 *  - Native currency is USDC (18 decimals for gas accounting).
 *  - USDC ERC-20 interface: 0x3600000000000000000000000000000000000000
 *    (6 decimals) on both networks; shares the native balance.
 *    https://docs.arc.io/arc/references/contract-addresses
 *
 * Sources:
 *  - https://docs.arc.io/arc/references/rpc-endpoints
 *  - https://docs.arc.io/arc/references/connect-to-arc
 *  - https://docs.arc.io/arc/concepts/stablecoin-native-model
 *  - https://docs.arc.io/arc/references/evm-differences
 */

export const ARC_MAINNET_CHAIN_ID = 5042;
export const ARC_TESTNET_CHAIN_ID = 5042002;

/** USDC ERC-20 interface — same address on Arc mainnet and testnet. */
export const USDC_ERC20_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

/** USDC ERC-20 interface decimals (application-level transfers). */
export const USDC_DECIMALS = 6;

/** Native gas accounting decimals on Arc. Never mix with ERC-20 units. */
export const USDC_NATIVE_DECIMALS = 18;

/** Minimum maxFeePerGas enforced by the Arc mempool (20 Gwei). */
export const ARC_MIN_MAX_FEE_PER_GAS = 20_000_000_000n;

/** EIP-7708 system emitter for native USDC Transfer logs (18 decimals). */
export const ARC_SYSTEM_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE" as const;

export const arcMainnet = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://explorer.arc.io" },
  },
  testnet: false,
});

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.io"],
      webSocket: ["wss://rpc.testnet.arc.io"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

/** Local development chain (arc-anvil --network arc, or plain anvil). */
export const arcLocal = defineChain({
  id: 31337,
  name: "Arc Local",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

export type NetworkName = "local" | "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  chain: ReturnType<typeof defineChain>;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string | null;
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  isMainnet: boolean;
}

export function explorerTxUrl(explorer: string | null, txHash: string): string | null {
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

export function explorerAddressUrl(
  explorer: string | null,
  address: string,
): string | null {
  return explorer ? `${explorer}/address/${address}` : null;
}
