import { describe, expect, it } from "vitest";
import { computeReceiptHash, computeSpecHash, hashCanonical } from "../src/hashing.js";
import { canonicalize } from "../src/canonical.js";

describe("canonicalize", () => {
  it("sorts keys recursively and drops undefined", () => {
    const a = canonicalize({ b: 1, a: { d: 2, c: 3 }, u: undefined });
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
  it("is stable regardless of input key order", () => {
    const x = hashCanonical({ a: 1, b: { y: 2, x: 3 } });
    const y = hashCanonical({ b: { x: 3, y: 2 }, a: 1 });
    expect(x).toBe(y);
  });
});

const gap = {
  protocol: "gap402",
  version: "1",
  id: "gap_t",
  question: "q",
  claim: "c",
  requirements: { claim: "c" },
  budgetUnits: "1000",
  currency: "USDC",
  requester: { id: "r", kind: "service" },
  requesterAddress: "0x1000000000000000000000000000000000000001",
  verifierAddress: "0x2000000000000000000000000000000000000002",
  createdAt: "2026-09-17T00:00:00Z",
  deadline: "2026-09-17T01:00:00Z",
  status: "open",
};

describe("computeSpecHash", () => {
  it("ignores lifecycle status", () => {
    const a = computeSpecHash({ ...gap, status: "open" } as never);
    const b = computeSpecHash({ ...gap, status: "settled" } as never);
    expect(a).toBe(b);
  });
  it("changes with spec fields", () => {
    const a = computeSpecHash(gap as never);
    const b = computeSpecHash({ ...gap, claim: "different" } as never);
    expect(a).not.toBe(b);
  });
});

describe("computeReceiptHash", () => {
  const receipt = {
    protocol: "gap402",
    version: "1",
    id: "rcpt_t",
    bountyId: "gap_t",
    requestHash: `0x${"11".repeat(32)}`,
    targetClaim: "c",
    chainId: 31337,
    bountyContract: "0x3000000000000000000000000000000000000003",
    acceptedEvidence: [],
    rejectedEvidence: [],
    totalPaidUnits: "0",
    refundUnits: "1000",
    verifierFeeUnits: "0",
    settlementHash: `0x${"22".repeat(32)}`,
    receiptHash: `0x${"00".repeat(32)}`,
    evaluatorVersion: "t",
    network: "local",
    createdAt: "2026-09-17T00:00:00Z",
  };
  it("excludes settlementTx so the hash can precede the anchor tx", () => {
    const before = computeReceiptHash(receipt as never);
    const after = computeReceiptHash({
      ...receipt,
      settlementTx: `0x${"aa".repeat(32)}`,
    } as never);
    expect(after).toBe(before);
  });
});
