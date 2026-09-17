import type { BountyStatus } from "@gap402/schemas";

/**
 * Offchain lifecycle. Onchain states are a subset: Open -> Settled | Cancelled.
 *
 *   detected -> funded -> open -> submissions -> verified -> settled -> consumed
 *                       |                                   (deadline)
 *                       +-> expired -> cancelled
 */
const TRANSITIONS: Record<BountyStatus, readonly BountyStatus[]> = {
  detected: ["funded", "cancelled"],
  funded: ["open", "cancelled"],
  open: ["submissions", "verified", "expired", "cancelled"],
  submissions: ["verified", "expired", "cancelled"],
  verified: ["settled", "expired"],
  settled: ["consumed"],
  consumed: [],
  expired: ["cancelled"],
  cancelled: [],
};

export function canTransition(from: BountyStatus, to: BountyStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BountyStatus, to: BountyStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid bounty status transition: ${from} -> ${to}`);
  }
}
