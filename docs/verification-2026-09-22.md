# Verification record — 22 September 2026

Scope: winner-informed evidence walkthrough, portable proofs, policy enforcement,
operator authentication and honest runtime labels. Research and before/after
comparison: [winner research](winner-research.md).

Checks ran against this working repository in Ubuntu WSL using Node/pnpm and Arc
Foundry; Windows Git handles the commit and push. No production or mainnet funds
were moved. Local logs are ephemeral under WSL `/tmp/gap402-*.log`.

| Check | Observed result |
| --- | --- |
| Install | `CI=true pnpm install --offline --no-frozen-lockfile` passed; lockfile includes the web protocol dependency. Initial frozen install correctly refused the changed manifest. |
| Lint | `pnpm lint` passed. |
| Types | `pnpm typecheck` passed, including SDK and buyer tests. Buyer typecheck passed again after the final regression test. |
| Unit/integration | Full `pnpm test` passed 62 tests. One additional buyer regression was then added; its entire 3-test suite passed. Thus 63 distinct final tests were checked, rather than a claim that the earlier full run printed 63. API's final focused run passed all 14 tests. |
| Contracts | `arc-forge test --network arc -vvv`: 23 passed, 0 failed, 0 skipped. |
| Local onchain E2E | `pnpm demo` passed: local Arc escrow, supplier payouts, receipt anchor verification, and expired-bounty cancellation/refund. Evidence and semantic review use synthetic fixtures. This is not an Arc mainnet transaction. |
| Build | `pnpm build` passed TypeScript stages but initially failed Next's workspace `.js` source resolution. After correcting extension aliases/transpilation, `pnpm --filter @gap402/web build` passed compilation, type validation, static generation and tracing. All final components built successfully. |
| Production HTTP | Next production server on port 3042 returned 200 for `/`, `/lab`, `/verify`, `/gaps`, `/receipts`. Web-proxy POSTs for all three demo scenarios returned 200; invalid scenario returned 400. |
| Demo behavior | Mixed and rejected scenarios generated internally valid proofs and reported actual spend `0`. Rejected scenario paid no suppliers. Insufficient scenario blocked at `2/3` source domains and produced no plan/receipt. |
| Offline CLI | Exported simulated bundle passed `proof-verify`; all integrity checks true and anchor explicitly `not-checked`. |
| Mainnet guard | With signer/token variables unset, `MAINNET_ENABLED=true DEMO_CONFIRM=YES pnpm demo:mainnet` exited 1 at the missing write-token guard, before transactions. |
| Browser visual/click QA | Not performed: browser connector reported no browser; native Computer Use pipe was unavailable. HTTP smoke checks and production compilation do not replace visual or interaction QA. |

## Best review sequence

1. Run API and web as described in README; open `/lab`. Choose the mixed case:
   unsupported claim, capped bounty, accepted/rejected sources, duplicate block,
   allocation, receipt, and the agent's changed decision appear in one flow.
2. Download the proof and open it in `/verify`; alter a payout recipient or
   amount to see integrity failure. An entirely re-authored consistent bundle
   still requires an independently trusted onchain anchor.
3. Run the rejected and insufficient-source cases. The agent abstains rather
   than presenting a payment receipt as evidence of truth.
4. Run `pnpm demo` for actual escrow/payout/anchor transactions on local Arc.
   Use the mainnet runbook only with real deployment configuration and funding.

## Remaining external requirements and limits

- No public mainnet deployment or real-source mainnet receipt was produced.
  Hosting destination, Arc mainnet RPC/contracts, funded signers, operator token
  and a suitable semantic provider must be configured for that milestone.
- Current verifier reads sanitized supplier excerpts and metadata. It neither
  independently fetches the source nor authenticates the publisher. Domain
  diversity is a heuristic, not proof of independent ownership.
- The buyer's spending reservation is per process instance, not durable across
  restarts. Ambiguous funding failures retain the reservation conservatively.
- Offline proofs check binding/accounting/integrity, not factual truth,
  signatures or registry authentication. The UI and CLI state this explicitly.
- The current Microgrants call requires a working Arc mainnet deployment; this
  work improves the product but does not establish eligibility, adoption,
  revenue or likely funding. Prior Circle/Arc funding eligibility needs the
  applicant's own confirmation. See linked official criteria in the research.
