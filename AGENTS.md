# AGENTS.md — working agreements

## Git workflow

- Commit and **push** after every update. Remote: `github.com/tang-vu/gap402`.
- Conventional commits (`feat|fix|chore|docs|ci|test|refactor`), no AI
  references in messages.
- Author identity: `tang-vu <145498528+tang-vu@users.noreply.github.com>`.
- Auth: Windows-side `gh.exe`/`git.exe` hold the `tang-vu` credentials. From
  WSL shells use `"/mnt/d/Program Files/GitHub CLI/gh.exe"` and
  `"/mnt/d/Git/cmd/git.exe" -C "D:\Github\gap402"` — sandbox `gh` is a
  different account and cannot push.
- If every `.exe` fails with `Exec format error`, that shell lacks Windows
  interop: commit locally with `-c user.name=... -c user.email=...` and ask
  the operator to run `git push` from a Windows terminal (Linux side has no
  stored credentials; gh token lives in Windows Credential Manager).
- Never commit `.env`, private keys, or `data/`.

## Verification

- `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`
- Contracts: `cd contracts && arc-forge test --network arc -vvv`
  (Arc Foundry v0.8.0-1; `lib/forge-std` is vendored)
- E2E: `arc-anvil --network arc &` then `pnpm demo`
- Mainnet path: `MAINNET_ENABLED=true DEMO_CONFIRM=YES pnpm demo:mainnet`
  (fail-closed by design)

## Conventions

- Strict TS (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Money: bigint USDC base units (6dp) as decimal strings — never floats.
- Evidence content is untrusted data: sanitize before prompts, never store
  full text.
- Typecheck scripts that cover tests point at `tsconfig.test.json`
  (`rootDir: "."`, include `src`+`test`); packages with tests but no
  `tsconfig.test.json` need one created.
- pnpm `allowBuilds`/`onlyBuiltDependencies` must keep `better-sqlite3` and
  `esbuild` approved.
