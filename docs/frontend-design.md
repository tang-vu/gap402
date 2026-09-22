# Frontend direction: the evidence exchange

Gap402 treats a claim as an open dossier. Numbered source slips connect declared
requirements, recorded checks, allocation and a portable Evidence Receipt. This
campaign redesigns the working application, not just its cover.

## Audit and references

Started from a clean working tree at `5f27c7e91e726f0966488d8e7818393bda1e1542`.
Read the product README, previous design direction, demo script, every web route,
API types, demo implementation, protocol verification and schema definitions.
The previous evidence-desk pass had useful honesty labels, but disconnected lab
panels, unreadably small radial graphs, raw requirements and wide mobile tables.
Its mobile banner also hid environment fields through positional CSS selectors.

Opened and visually inspected [Bearplus](https://bear.plus/) and
[Heron AI](https://heronaiapp.com/). The useful references were large asymmetric
composition, fine registration rules, domain-specific annotations, and interaction
inside the subject matter. No reference artwork, brand asset or customer metric
was copied. Early captures caught the references before their entrance animations;
subsequent settled captures showed their content.

Baseline screenshots are in [images/before](images/before). Populated detail
screens use an explicitly labeled, review-only API adapter containing actual
`POST /api/demo` responses. They do not represent market activity or chain payments.

## Art direction and assets

- Warm ivory `#F4F0E7`, deep ink `#21231F`, oxide `#C65A35`. Darker oxide
  `#A33F22` provides accessible small text. Separate green, amber and red tokens
  identify outcomes with text labels; color is never the only signal.
- Self-hosted Instrument Serif regular/italic and variable DM Sans. Three Latin
  WOFF2 files total 80,092 bytes. Their SIL Open Font Licenses are included in
  `apps/web/public/fonts`. Controls remain available with fallback fonts.
- Original `DossierScene` artwork uses semantic HTML, CSS paper depth and an SVG
  registration/connector drawing. Claim text, source identities and labels remain
  DOM content. Financial values are never rasterized.
- A six-step spacing scale, editorial headings, sans-serif controls, tabular
  monetary figures, thin rules, paper surfaces and an ink inspection desk carry
  through all routes. Outcome badges and runtime labels remain visible on mobile.
- Short 180 ms feedback and bounded 500–650 ms entrance animations. No autoplay,
  render loop or scroll mutation. The story observer disconnects on unmount;
  request timers and controllers are cleaned up. Reduced motion removes entrance
  animation and sticky presentation.

## Route and interaction map

| Route | Working experience |
| --- | --- |
| `/` | Composed cover, original dossier scene, five linked chapters, persistent illustrative source selection, real open-market preview, honest unavailable/empty states |
| `/lab` | Actual demo response, explicit completed-result replay, three scenarios, five manual chapters, persistent claim/rules, keyboard source selection, checks/allocation/inclusion inspector, exact budget ledger, export and local verification |
| `/gaps` | Search claim/identifier, filter actual lifecycle values, sort exact bigint budget/deadline/source count, compact mobile records |
| `/gaps/[id]` | Claim-first investigation, readable requirements, advanced JSON, selectable source list, complete metadata, exact allocation explanations, actual transaction records only |
| `/receipts` | Paper-document archive with claim, source counts, paid amount, runtime and receipt hash |
| `/receipts/[id]` | Receipt document, exact supplier/fee/refund accounting, selectable accepted/rejected entries, scores, full identifiers, copy, original JSON, portable proof and return to bounty |
| `/verify` | Local file/paste desk, editable JSON, 1 MB limit, download, invalid/malformed/tampered feedback and explicit descriptions of all eleven consistency checks |

### Lab state model

The API returns a completed scenario. Presentation chapters replay that response;
no label claims live streaming execution. Switching cases aborts the current
request and invalidates its generation. Completed results are cached per scenario
for the mounted session. Replay, restart, source selection and chapter navigation
make no new request. A failed or timed-out request stays retryable. Navigating away
aborts pending work.

Mixed preserves both useful sources, stale rejection and the prevented tracking
repost. Rejected preserves zero supplier payout, the verifier fee and the requester
refund. Insufficient shows the returned domain requirement failure and creates no
plan or receipt. Actual spend remains separately visible as zero.

### Meaning and accounting

All amounts remain six-decimal integer strings/bigints. `plan.payouts` already
contains the verifier-fee row. The accounting view sums those rows once, adds the
refund, checks the declared budget and separately validates the fee and total.
Only the final drawing ratio becomes a bounded-precision number; amounts never
pass through floating point. The unit suite includes values beyond the safe
integer range and all-rejected accounting.

A lifecycle position is not evidence of previous transactions. Funding and
settlement links require the corresponding runtime hash. Missing chain evidence
is described as missing, without inferring that every unfunded record must be a
simulation. Local, testnet, mainnet, unknown and API-offline labels are retained.
Source scores are evaluations, not truth probabilities. Domain diversity does not
establish independent ownership. Offline consistency checks do not authenticate
an independent registry or the claim; a self-consistent forged bundle can pass.
x402 per-call pricing remains labeled roadmap material.

## Reproduce review without disrupting hosting

The live host reads `.next`. Never build into that directory while it is serving.
`NEXT_DIST_DIR` supports a separate review artifact. This run used an isolated WSL
checkout at `/tmp/gap402-design`, a separate pnpm store, and a review API on 4028.
The final production browser pass used port 3050; the commands below use 3046.
The public services, authentication gates and signing configuration were preserved.

```sh
# In an isolated checkout, using the repository lockfile:
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
NEXT_DIST_DIR=.next-production-review GAP402_API=http://127.0.0.1:4028 pnpm build

# Terminal 1: review adapter fetches actual isolated demo responses from :4020.
# It holds fixtures in memory and binds only loopback; never use as a public API.
node scripts/ui-fixture-server.mjs

# Terminal 2:
NEXT_DIST_DIR=.next-production-review GAP402_API=http://127.0.0.1:4028 \
  pnpm --filter @gap402/web exec next start -p 3046 -H 127.0.0.1

# Browser tools are review-only, outside the application dependency graph:
npm install --prefix /tmp/gap402-ui-qa playwright @axe-core/playwright
UI_QA_PACKAGE=/tmp/gap402-ui-qa/package.json node scripts/ui-review.mjs
```

The adapter's `/__review/*` controls are only test-harness modes: populated, empty,
offline, unknown network and stress (45 sources/long claim). They are not added to
the application API. Browser assertions, scans, screenshots and measurements are
written into `docs/`. The downloaded synthetic proof remains in the OS temp folder.

## Verification record / 23 September 2026

- `pnpm install`: passed under WSL. A native Windows attempt stopped before changes
  because the installed dependencies were Linux-side. The isolated checkout used
  the same frozen lockfile and a separate writable pnpm store.
- `pnpm lint`: passed. `pnpm typecheck`: passed across the workspace, including
  the web's strict flags and new `tsconfig.test.json`.
- `pnpm test`: **71 tests passed**, including 8 new frontend behavior tests.
  Packages with no tests are not counted as browser validation.
- `pnpm build`: passed across packages and Next production routes. The first run
  was terminated during trace collection; the isolated rerun and subsequent final
  web builds passed without compilation warnings.
- `arc-forge test --network arc -vvv`: **23 passed**, including fuzz cases.
- `LOCAL_RPC_URL=http://127.0.0.1:8548 GAP402_NETWORK=local MAINNET_ENABLED=false pnpm demo`:
  passed against a separate `arc-anvil --network arc --port 8548`. Fund, settle,
  receipt anchoring and expired-bounty refund completed locally. The existing chain
  at 8545 was not reset. No mainnet demo was run.
- Production Chromium: **139/139 assertions passed**, **zero page JavaScript
  errors**. All seven routes at 320/390/768/1440 px; all lab outcomes; keyboard
  source/diagram/chapter selection; replay/cache/restart; source-to-payout-to-receipt
  continuity; exact fee/refund accounting; copy/export; local valid/tampered/invalid
  proofs; malformed and oversized files; edits invalidating results; failure,
  timeout, cancellation and retry; 45-source/long-claim stress; unsafe URLs; unknown
  metadata/network; empty and offline states; 404; reduced motion; 200% CSS zoom.
- Axe WCAG 2 A/AA + 2.1 AA: **zero detected violations in eight scans**, covering
  every route and a populated lab. This does not establish full conformance.
- The browser pass found and resolved an ambiguous select label, stale server-error
  recovery and an allocation overflow at 200% CSS zoom. Inspection also shortened
  the mobile rules panel and corrected screenshot framing of the sticky dossier.
- The live host at `127.0.0.1:3043` still returned HTTP 200 after review. Its build,
  PM2 configuration, tunnel, authentication and spending gates were not replaced.

[Machine-readable results](frontend-review-results.json) include all assertions,
scan results and raw production resource timings.

### Production payload and responsiveness

Next reports shared first-load JS of 102 kB. Route totals: home 110 kB, market
108 kB, investigation 110 kB, lab 112 kB, archive 106 kB, receipt 129 kB, verifier
123 kB. The lab loads the proof inspector separately when its receipt chapter opens.

A fresh local Chromium context at 1440 × 1000 measured:

| Measurement | Observed |
| --- | ---: |
| Home JavaScript transfer (including response overhead) | 115,021 bytes |
| Stylesheet transfer | 9,639 bytes |
| Three self-hosted font transfers | 80,992 bytes |
| HTML transfer | 8,735 bytes |
| Other/prefetch transfers | 1,719 bytes |
| Total recorded cold home transfer | 216,106 bytes |
| First contentful paint / largest contentful paint | 140 ms / 140 ms |
| Source click to second animation frame | 18 ms |

These are single local, unthrottled observations, not field Core Web Vitals or an
INP claim. Encoded body sizes and individual resources are retained in the report.
No application dependency was added; Playwright and axe are external review tools.

### Remaining limits

Chromium was inspected headlessly in WSL. Safari, Firefox, physical touch devices,
screen-reader sessions, browser-chrome zoom and OS magnification were not separately
exercised. The 200% check uses CSS zoom/reflow and is supplemented by the narrow
viewport suite. The public host remains on its prior build to preserve its running
service; this campaign is committed code with an isolated production review, not a
claim of public redeployment. Review market/receipt data are explicitly labeled
fixtures, and the localhost timings do not predict public-network performance.

## Screenshots

![Evidence exchange cover](images/frontend-home.png)

![Evidence lab workspace](images/frontend-lab.png)

Full route captures are in [images/after](images/after), including mobile layouts,
all three lab outcomes and a valid local proof. These captures are labeled review
fixtures, not production adoption or mainnet evidence.
