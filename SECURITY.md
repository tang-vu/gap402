# Security Policy

## Reporting

Please report vulnerabilities privately — open a GitHub security advisory
on the repository or contact the maintainers. Do not open a public issue
for an exploitable bug.

## Scope

- `contracts/` — escrow, settlement vector validation, receipt anchoring
- `packages/settlement` — deterministic accounting
- `packages/verifier` — evaluation pipeline and prompt-injection surface
- `apps/api` — persistence, auth boundaries, onchain submission paths
- `packages/sdk` — key handling, chain-id verification

## In scope for this version

- Exact-sum accounting and escrow integrity
- Duplicate/double-settlement prevention
- Reentrancy, deadline, and access-control bugs
- Prompt injection through evidence content
- Network/chain-id confusion that could misdirect funds
- Secret leakage (keys, `.env`, logs)

## Out of scope (v1, documented)

- Honesty of the designated verifier's *judgment* — the contract enforces
  accounting, not truth; verifier selection is governance (see roadmap)
- Availability of the centralized demo API
- Truthfulness of evidence sources themselves

## Handling rules for contributors

- All USDC math: `bigint`, 6-decimal base units, no floats.
- Evidence content is untrusted data — sanitize before prompts, never store
  full text.
- Keys come from env only; never log, commit, or default to a real key.
- Mainnet paths fail closed: `MAINNET_ENABLED`, chain-id assert, spend caps.
