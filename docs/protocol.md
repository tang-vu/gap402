# Gap402 Protocol

Version 1. `protocol: "gap402"`, `version: "1"` on every document.

## Lifecycle

```text
detected -> funded -> open -> submissions -> verified -> settled -> consumed
                \-> cancelled / expired (refund paths)
```

| status | meaning |
| --- | --- |
| `detected` | gap recorded, not yet funded |
| `funded`/`open` | USDC escrowed onchain; accepting submissions |
| `submissions` | at least one submission received |
| `verified` | evaluation produced for all submissions |
| `settled` | payouts executed, receipt anchored |
| `consumed` | buyer consumed the receipt |
| `cancelled` | requester cancelled after deadline; escrow refunded |
| `expired` | deadline passed without settlement |

## Documents

All documents are canonical JSON. Canonicalization (`packages/protocol`)
sorts object keys recursively, drops `undefined`, and serializes with no
insignificant whitespace. Hashes are `keccak256(utf8(canonicalJson))`.

### GapRequest

```json
{
  "protocol": "gap402", "version": "1",
  "id": "gap_…",
  "question": "…",
  "claim": "exact proposition requiring evidence",
  "context": "…",
  "requirements": { "…": "see below" },
  "budgetUnits": "50000",            // USDC base units, integer string
  "currency": "USDC",
  "requester": { "id", "kind", "walletAddress" },
  "requesterAddress": "0x…",
  "verifierAddress": "0x…",
  "createdAt": "…", "deadline": "…",
  "status": "open"
}
```

`specHash = keccak256(canonical(GapRequest minus status))` — status is
runtime state, not part of the spec. The contract stores `specHash` at
creation; anyone can recompute it from the published request.

### EvidenceRequirement (all optional unless noted)

| field | type | meaning |
| --- | --- | --- |
| `claim` | string (required) | the proposition to verify |
| `allowedSourceTypes` / `bannedSourceTypes` | enum[] | `official primary independent aggregated social wiki` |
| `maxSourceAgeSeconds` | int | retrieved-vs-published freshness bound |
| `minPublishedAt` | ISO | earliest acceptable publication |
| `requirePrimarySource` | bool | at least one `primary` source required |
| `requireIndependentSources` | bool | each submission must not share a root domain with prior accepted ones |
| `minIndependentSources` | int | count floor across accepted set |
| `domainAllowlist` / `domainBlocklist` | string[] | host rules |
| `minSupportScore` | int [0,1e6] | per-evidence support floor |
| `rejectDuplicates` | bool | canonical-URL + content-hash dedup (default true) |
| `requireCitation` | bool | excerpt or structured proof required |

### EvidenceSubmission

```json
{
  "id": "sub_…", "bountyId": "gap_…",
  "supplier": { "id", "kind", "walletAddress" },
  "supplierAddress": "0x…",
  "canonicalUrl": "https://…",       // normalized: utm/fb params stripped
  "originalUrl": "…",
  "title": "…", "publisher": "…",
  "publishedAt": "…", "retrievedAt": "…",
  "contentHash": "0x…",              // keccak256 of retrieved content/excerpt
  "excerpt": "≤2KB sanitized excerpt",
  "claimRelation": "supports|contradicts|contextual|unrelated|unknown",
  "sourceType": "official|primary|independent|aggregated|social|wiki|unknown",
  "costUnits": "…", "signature": "0x…",
  "submittedAt": "…"
}
```

Full copyrighted text is never stored — hashes, bounded excerpts, metadata
and resolvable URLs only.

### EvidenceEvaluation

Per submission: `verdict` (`accepted|rejected`), `rejectReasons[]`, five
factor scores in `[0, 1_000_000]`, `confidence`, a `checks[]` trail
(name/passed/detail), and `evaluatorVersion`. Evaluations are replayable:
same inputs + stored model response reproduce the same record.

### SettlementPlan

Produced by `buildSettlementPlan` (`gap402-portfolio-v1`):

```text
quality_i      = support·provenance·independence·novelty·freshness / 1e6^4
verifierFee    = bounty · verifierFeeBps / 10000
distributable  = bounty − verifierFee
share_i        ∝ quality_i over recipients (submissions aggregated per
                 supplier address — one supplier can never draw two lines)
cap            = distributable · maxShareBps / 10000   (per recipient)
floor          = minPayoutUnits                         (drop + redistribute)
remainder      → largest-remainder, submissionId tie-break
invariant      sum(payouts) + refund == bounty          // always
```

The plan is deterministic: identical inputs yield identical bytes, so
`settlementHash` is reproducible offchain and verifiable onchain.

### EvidenceReceipt

Final artifact. `receiptHash = keccak256(canonical(receipt minus
{receiptHash, settlementTx}))` — `settlementTx` is excluded because it names
the anchor transaction, which cannot exist before the anchor is sent.

Anchored in `EvidenceReceiptRegistry` by `GapBounty.finalize`. Verify with
`gap402 receipt verify` — recompute hash, check schema, sum payouts, query
`isAnchored` on the registry.

## Onchain surface

`GapBounty` (escrow + settlement) and `EvidenceReceiptRegistry` (anchored
hashes). Evaluation, scoring and receipts live offchain — the chain stores
commitments (`specHash`, evidence `contentHash`es, `settlementHash`,
`receiptHash`) and moves USDC exactly.

| function | actor | effect |
| --- | --- | --- |
| `createBounty(specHash, verifier, amount, deadline, maxCommitments)` | requester | escrows `amount` USDC, opens bounty |
| `commitEvidence(bountyId, evidenceHash)` | anyone | records commitment; dedup + cap + deadline enforced |
| `finalize(bountyId, recipients[], amounts[], settlementHash, receiptHash)` | verifier only | exact-sum payout vector, anchors receipt, refunds residue |
| `cancel(bountyId)` | requester | after deadline, refunds escrow |

Payout rules enforced by the contract: strictly increasing recipient order,
no zero address, no zero amount, `sum(amounts) ≤ escrow` with the remainder
refunded, single finalization per bounty.

## Money units — read this before touching amounts

Arc has ONE USDC balance behind two interfaces:

- native / gas / `msg.value`: **18 decimals**
- ERC-20 interface (`0x3600…0000`): **6 decimals**

Gap402 uses **6-decimal base units** everywhere — `budgetUnits`,
`payoutUnits`, `amountUnits` are integer strings parseable by `BigInt`.
Never bridge the two precisions; never use floats.
