# Contributing

Thanks for helping build the missing-knowledge market.

## Setup

```bash
pnpm install
arc-anvil --network arc --port 8545   # terminal 1
pnpm demo                             # terminal 2: full e2e
pnpm test && pnpm typecheck && pnpm lint
```

## Conventions

- TypeScript strict; `bigint` for all USDC amounts (6-decimal base units).
- No floats for money, ever.
- Determinism is a feature: canonical JSON, sorted keys, stable tie-breaks.
- Commits: conventional format (`feat:`, `fix:`, `test:`, …), focused diffs.
- Keep files small and readable; prefer real behavior over abstraction.
- Never commit secrets, `.env` files, keys, or credentials.
- Contracts stay small and immutable — complexity belongs offchain.

## Tests

Every PR should keep these green:

```bash
pnpm test              # vitest
pnpm test:contracts    # arc-forge test --network arc
pnpm typecheck
pnpm lint
pnpm build
```

## Where things live

| change | place |
| --- | --- |
| network params | `packages/config` (verify against docs.arc.io first) |
| domain model | `packages/schemas` + `packages/protocol` hashing |
| allocation math | `packages/settlement` + property tests |
| contracts | `contracts/src` + `contracts/test` |
| REST surface | `apps/api` |
| agent-facing client | `packages/sdk` |
| UI | `apps/web` |

## Reporting vulnerabilities

See [SECURITY.md](SECURITY.md).
