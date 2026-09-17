import { describe, expect, it } from "vitest";
import {
  ConfigError,
  assertChainId,
  formatUsdcAmount,
  parseUsdcAmount,
  resolveNetwork,
} from "../src/index.js";

describe("USDC unit conversion", () => {
  it("parses human amounts to 6-decimal base units", () => {
    expect(parseUsdcAmount("0.05")).toBe(50_000n);
    expect(parseUsdcAmount("1")).toBe(1_000_000n);
    expect(parseUsdcAmount("0.000001")).toBe(1n);
  });
  it("rejects floats beyond 6 decimals and garbage", () => {
    expect(() => parseUsdcAmount("0.0000001")).toThrow(ConfigError);
    expect(() => parseUsdcAmount("abc")).toThrow(ConfigError);
    expect(() => parseUsdcAmount("-1")).toThrow(ConfigError);
  });
  it("formats back to fixed 6dp", () => {
    expect(formatUsdcAmount(50_000n)).toBe("0.050000");
    expect(formatUsdcAmount(1n)).toBe("0.000001");
  });
});

describe("network resolution", () => {
  it("fails closed on mainnet without MAINNET_ENABLED", () => {
    delete process.env.MAINNET_ENABLED;
    expect(() => resolveNetwork("mainnet")).toThrow(ConfigError);
  });
  it("rejects non-http RPC URLs", () => {
    process.env.LOCAL_RPC_URL = "file:///etc/passwd";
    expect(() => resolveNetwork("local")).toThrow(ConfigError);
    delete process.env.LOCAL_RPC_URL;
  });
});

describe("assertChainId", () => {
  it("throws on mismatch so mainnet never lands on testnet", () => {
    const local = resolveNetwork("local");
    expect(() => assertChainId(local, 5042)).toThrow(ConfigError);
    expect(() => assertChainId(local, local.chainId)).not.toThrow();
  });
});
