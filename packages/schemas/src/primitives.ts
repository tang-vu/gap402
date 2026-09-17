import { z } from "zod";

/** Shared scalar primitives for the gap402 protocol model. */

export const PROTOCOL_ID = "gap402" as const;
export const PROTOCOL_VERSION = "1" as const;

/** Scores are integers scaled by SCORE_SCALE (1e6). 0 = 0%, 1e6 = 100%. */
export const SCORE_SCALE = 1_000_000;
export const BPS_SCALE = 10_000;

export const scoreSchema = z
  .number()
  .int()
  .min(0)
  .max(SCORE_SCALE)
  .describe("Score in [0, 1_000_000] fixed-point units");

export const bpsSchema = z
  .number()
  .int()
  .min(0)
  .max(BPS_SCALE)
  .describe("Basis points in [0, 10000]");

/** USDC amounts are always base units (6 decimals) encoded as decimal strings. */
export const usdcUnitsSchema = z
  .string()
  .regex(/^\d+$/, "USDC units must be a non-negative integer string")
  .describe("USDC amount in 6-decimal base units");

export const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address")
  .transform((v) => v as `0x${string}`);

export const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex")
  .transform((v) => v as `0x${string}`);

export const txHashSchema = bytes32Schema;

export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 timestamp");

export const urlSchema = z.string().url().max(2048);

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
