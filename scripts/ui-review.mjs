// Run against an isolated production review server and ui-fixture-server.mjs.
// Browser tooling is installed outside the application (see frontend-design.md).
import { createRequire } from "node:module";
import { resolve } from "node:path";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
const proofPath = resolve(tmpdir(), "gap402-review-proof.json");
const require = createRequire(process.env.UI_QA_PACKAGE ?? resolve("package.json"));
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const base = process.env.UI_BASE ?? "http://127.0.0.1:3046";
const api = "http://127.0.0.1:4028";
const out = resolve(process.env.UI_OUTPUT ?? "docs/images/after");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const report = { checks: [], accessibility: [], errors: [], metrics: {} };
page.on("pageerror", (e) => report.errors.push(e.message));
function check(name, value) {
  report.checks.push({ name, passed: !!value });
  console.log(value ? "PASS" : "FAIL", name);
  if (!value) throw new Error(name);
}
async function mode(value) {
  await fetch(`${api}/__review/${value}`);
}
async function go(path) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(name) {
  check(
    name,
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
}
const runs = {};
for (const scenario of ["mixed", "rejected", "insufficient"])
  runs[scenario] = await (
    await fetch(`${api}/api/demo`, { method: "POST", body: JSON.stringify({ scenario }) })
  ).json();
const gapPath = `/gaps/${runs.mixed.gap.id}`;
const receiptPath = `/receipts/${runs.mixed.receipt.id}`;
const routes = [
  ["home", "/"],
  ["lab", "/lab"],
  ["market", "/gaps"],
  ["gap", gapPath],
  ["archive", "/receipts"],
  ["receipt", receiptPath],
  ["verify", "/verify"],
];
const money = (units) =>
  `${BigInt(units) / 1000000n}.${(BigInt(units) % 1000000n).toString().padStart(6, "0")}`;
try {
  await mode("populated");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of routes) {
      await go(path);
      await noOverflow(`${name}: ${width}px no overflow`);
      check(
        `${name}: ${width}px environment visible`,
        await page.locator(".banner").isVisible(),
      );
      if (width === 390 || width === 1440)
        await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
    }
  }
  // The home composition is recorded while the real GSAP timelines run.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/");
  await page.getByRole("button", { name: "Replay motion" }).click();
  await page.waitForTimeout(1100);
  await page
    .locator(".exchange-cover .dossier-scene")
    .screenshot({ path: `${out}/motion-hero-1s.png` });
  await page.waitForTimeout(2100);
  await page
    .locator(".exchange-cover .dossier-scene")
    .screenshot({ path: `${out}/motion-hero-3s.png` });
  await page.getByRole("button", { name: "Pause motion" }).click();
  check(
    "hero pause control",
    await page.getByRole("button", { name: "Play motion", exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "Replay motion" }).click();
  await go("/lab");
  check("interrupted hero navigation", await page.locator(".lab-controls").isVisible());
  await go("/");
  await page.getByRole("button", { name: "04 Record" }).click();
  await page.waitForTimeout(900);
  await page
    .locator(".story-stage")
    .screenshot({ path: `${out}/motion-story-record.png` });
  const forward = await page.locator(".dossier-story .claim-paper").getAttribute("style");
  await page.getByRole("button", { name: "01 Request" }).click();
  await page.waitForTimeout(900);
  await page
    .locator(".story-stage")
    .screenshot({ path: `${out}/motion-story-request.png` });
  check(
    "story reverse changes geometry",
    forward !== (await page.locator(".dossier-story .claim-paper").getAttribute("style")),
  );
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole("button", { name: "03 Allocate" }).click();
  await page.waitForTimeout(700);
  await noOverflow("story resize during timeline");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // One result, five chapters; sources are selected by keyboard and stay selected.
  await go("/lab");
  let calls = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/api/demo")) calls++;
  });
  for (const scenario of ["mixed", "rejected", "insufficient"]) {
    await page.locator(`input[value=${scenario}]`).check();
    await page.getByRole("button", { name: "Run this experiment" }).click();
    await page.getByText("Experiment complete.").waitFor();
    const requestCount = calls;
    await page.getByRole("button", { name: "Pause playback" }).click();
    await page.getByRole("slider", { name: "Seek completed result" }).fill("7.5");
    await page
      .locator(".source-journey")
      .screenshot({ path: `${out}/motion-lab-${scenario}-allocate.png` });
    check(`${scenario}: seek sends no request`, calls === requestCount);
    await page.getByRole("button", { name: "Replay from start" }).click();
    await page.getByRole("button", { name: "Pause playback" }).click();
    const run = runs[scenario];
    check(
      `${scenario}: all returned sources listed`,
      (await page.locator(".source-card").count()) === run.submissions.length,
    );
    check(
      `${scenario}: zero actual spend separate`,
      (await page.locator(".simulation-spend").innerText()).includes("0.000000 USDC"),
    );
    if (scenario === "mixed") {
      await page.locator(".source-card").nth(1).focus();
      await page.keyboard.press("Enter");
      check(
        "keyboard source selection",
        (await page.locator(".source-card").nth(1).getAttribute("aria-pressed")) ===
          "true",
      );
      check(
        "diagram follows inspector selection",
        (await page
          .locator(".journey-sources button")
          .nth(1)
          .getAttribute("aria-pressed")) === "true",
      );
      await page.locator(".journey-sources button").last().click();
      check(
        "diagram selection updates readable inspector",
        (await page.locator(".source-inspector").innerText()).includes("Old rumor"),
      );
      await page.locator(".source-card").nth(1).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "03 Source inspection" }).focus();
      await page.keyboard.press("Enter");
      check(
        "keyboard chapter selection",
        (await page
          .getByRole("button", { name: "03 Source inspection" })
          .getAttribute("aria-current")) === "step",
      );
    }
    await page.getByRole("button", { name: "04 Allocation" }).click();
    if (run.plan) {
      check(
        `${scenario}: fee and refund counted once`,
        (await page.locator(".allocation-row").count()) === run.plan.payouts.length + 1,
      );
      check(
        `${scenario}: exact reconciliation`,
        await page.getByText("Exact reconciliation").isVisible(),
      );
      for (const payout of run.plan.payouts)
        check(
          `${scenario}: actual amount ${payout.amountUnits}`,
          (await page.locator(".allocation-rows").innerText()).includes(
            money(payout.amountUnits),
          ),
        );
      await page.getByRole("button", { name: /Verifier fee/ }).click();
      check(
        `${scenario}: actual explanation available`,
        (await page.locator(".allocation-explanation").innerText()).includes(
          run.plan.payouts.find((p) => p.submissionId === "verifier-fee").recipient,
        ),
      );
    } else {
      check(
        "insufficient: no fabricated allocation",
        (await page.locator(".allocation").count()) === 0,
      );
      check(
        "insufficient: returned refusal",
        (await page.locator(".refusal").innerText()).includes(run.blockedReason),
      );
    }
    if (scenario === "mixed") {
      await page.locator(".source-card").nth(1).click();
      await page.getByRole("button", { name: "05 Portable receipt" }).click();
      check(
        "source persists into receipt chapter",
        (await page.locator(".source-card").nth(1).getAttribute("aria-pressed")) ===
          "true",
      );
      check(
        "selected source receipt inclusion",
        (await page.locator(".source-outcome").innerText()).includes("Accepted evidence"),
      );
      await page.getByRole("button", { name: "Verify in browser" }).click();
      await page.getByText("Integrity checks passed").waitFor();
      check(
        "lab returned bundle passes offline checks",
        (await page.locator(".proof-check").count()) === 11,
      );
      await page.getByRole("button", { name: "04 Allocation" }).click();
    } else if (scenario === "rejected") {
      check(
        "rejected: zero supplier amount",
        (await page.locator(".reconciliation").innerText()).includes(
          "0.000000 suppliers",
        ),
      );
    } else {
      await page.getByRole("button", { name: "05 Portable receipt" }).click();
      check(
        "insufficient: no proof input",
        (await page.locator("#proof-json").count()) === 0,
      );
      check(
        "insufficient: no receipt issued",
        await page.getByRole("heading", { name: "No receipt was issued." }).isVisible(),
      );
    }
    await page.screenshot({ path: `${out}/lab-${scenario}-1440.png`, fullPage: true });
    if (scenario === "mixed") {
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 1000 });
        await noOverflow(`populated lab: ${width}px`);
        if (width === 390)
          await page.screenshot({ path: `${out}/lab-result-390.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  check("one request per scenario", calls === 3);
  await page.locator("input[value=mixed]").check();
  check(
    "scenario cache restores result",
    await page.getByText("Experiment complete.").isVisible(),
  );
  await page.getByRole("button", { name: "Replay this result" }).click();
  await page.getByRole("button", { name: "Restart walkthrough" }).click();
  check("restart clears result", (await page.locator(".lab-replay").count()) === 0);
  await page.getByRole("button", { name: "Run this experiment" }).click();
  check("replay and restart reuse completed data", calls === 3);
  // Market search, sorting and clear action use only the returned records.
  await go("/gaps");
  await page.getByRole("searchbox").fill("no-such-claim");
  check(
    "honest filtered empty state",
    await page.getByText("No matching dossiers.").isVisible(),
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  check(
    "clear restores real records",
    (await page.locator(".register-row").count()) === 3,
  );
  await page.getByLabel("Lifecycle", { exact: true }).selectOption("consumed");
  check("lifecycle filter", (await page.locator(".register-row").count()) === 1);
  await page.getByLabel("Sort by", { exact: true }).selectOption("budget");
  await go(gapPath);
  await page.locator(".source-card").last().click();
  check(
    "stale rejection and zero payout visible",
    (await page.locator(".source-inspector").innerText()).includes("0.000000 USDC"),
  );
  await page.getByText("Source identity, timestamps & content hash").click();
  check(
    "full supplier and hash preserved",
    (await page.locator(".source-inspector").innerText()).includes(
      runs.mixed.submissions[2].contentHash,
    ),
  );
  check(
    "no invented funding link",
    (await page.getByRole("link", { name: "Funding transaction" }).count()) === 0,
  );
  await go(receiptPath);
  await page.locator(".receipt-entry").last().click();
  check(
    "receipt rejection inspection",
    await page
      .getByRole("heading", { name: "Retained in the rejection record." })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Copy receipt hash", exact: true }).click();
  check(
    "identifier copied exactly",
    (await page.evaluate(() => navigator.clipboard.readText())) ===
      runs.mixed.receipt.receiptHash,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  await download.saveAs(proofPath);
  check(
    "export includes original plan",
    JSON.parse(await fs.readFile(proofPath, "utf8")).plan.id === runs.mixed.plan.id,
  );
  // Local verification: import, edits, tamper, invalid schema and malformed files.
  await go("/verify");
  await page.locator("input[type=file]").setInputFiles(proofPath);
  let outbound = 0;
  const networkListener = () => outbound++;
  page.on("request", networkListener);
  await page.getByRole("button", { name: "Verify in browser" }).click();
  await page.getByText("Integrity checks passed").waitFor();
  check("local proof checks do not send requests", outbound === 0);
  page.off("request", networkListener);
  check(
    "every check describes its exact scope",
    (await page.locator(".proof-check p").count()) === 11,
  );
  await page.screenshot({ path: `${out}/proof-valid-1440.png`, fullPage: true });
  const proof = JSON.parse(await page.locator("#proof-json").inputValue());
  proof.plan.payouts[0].amountUnits = "1";
  await page.locator("#proof-json").fill(JSON.stringify(proof));
  check(
    "edits invalidate stale verification",
    (await page.locator(".proof-result").count()) === 0,
  );
  await page.getByRole("button", { name: "Verify in browser" }).click();
  await page.getByText(/Integrity checks failed/).waitFor();
  check("tampered proof rejected", (await page.locator(".check-fail").count()) > 0);
  await page.locator("#proof-json").fill("{}");
  await page.getByRole("button", { name: "Verify in browser" }).click();
  check(
    "invalid schema rejected",
    (await page.locator(".proof-result").innerText()).includes("schema"),
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  check(
    "malformed file feedback",
    await page.getByRole("alert").filter({ hasText: "malformed JSON" }).isVisible(),
  );
  await page.getByRole("button", { name: "Verify in browser" }).click();
  check(
    "malformed paste feedback",
    await page.getByRole("alert").filter({ hasText: "Invalid JSON" }).isVisible(),
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(1000001, 32),
  });
  check(
    "1 MB file limit",
    await page.getByRole("alert").filter({ hasText: "smaller than 1 MB" }).isVisible(),
  );
  await page.locator("#proof-json").fill("");
  check(
    "empty proof action disabled",
    await page.getByRole("button", { name: "Verify in browser" }).isDisabled(),
  );
  // Error, timeout and racing response states.
  await go("/lab");
  await page.route("**/api/demo", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Review service unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Run this experiment" }).click();
  await page.getByRole("button", { name: "Retry experiment" }).waitFor();
  check(
    "request failure has retry and no success",
    (await page.locator(".lab-replay").count()) === 0,
  );
  await page.unroute("**/api/demo");
  await page.getByRole("button", { name: "Retry experiment" }).click();
  await page.getByText("Experiment complete.").waitFor();
  check("request retry succeeds", (await page.locator(".source-card").count()) === 3);
  await go("/lab");
  await page.route("**/api/demo", () => {});
  await page.clock.install();
  await page.getByRole("button", { name: "Run this experiment" }).click();
  await page.clock.fastForward(21000);
  await page.getByText(/The experiment timed out/).waitFor();
  check(
    "timeout exposes retry",
    await page.getByRole("button", { name: "Retry experiment" }).isEnabled(),
  );
  await page.clock.resume();
  await page.unroute("**/api/demo");
  await go("/lab");
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/demo", async (route) => {
    await held;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(runs.mixed),
      })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "Run this experiment" }).click();
  await page.locator("input[value=insufficient]").check();
  release();
  await page.unrouteAll({ behavior: "wait" });
  check(
    "scenario switch cancels stale result",
    (await page.locator(".lab-replay").count()) === 0,
  );
  // Stress / unknowns, mobile environment, offline and real server retry.
  await mode("stress");
  await page.setViewportSize({ width: 320, height: 1000 });
  await go(gapPath);
  await noOverflow("long claim and 45 sources at 320px");
  check("many submissions retained", (await page.locator(".source-card").count()) === 45);
  await page.locator(".source-card").last().click();
  check(
    "unsafe source URL not linked",
    (await page.locator(".source-url").getAttribute("href")) === null,
  );
  await page.getByText("Source identity, timestamps & content hash").click();
  check(
    "unknown timestamp explicit",
    (await page.locator(".source-inspector").innerText()).includes("Unknown"),
  );
  await mode("unknown");
  await go("/gaps");
  check(
    "unknown network visible on mobile",
    (await page.locator(".banner").innerText()).includes("NETWORK UNKNOWN"),
  );
  await mode("empty");
  for (const path of ["/gaps", "/receipts"]) {
    await go(path);
    check(`${path}: honest empty state`, await page.locator(".empty-market").isVisible());
  }
  await mode("offline");
  await go("/");
  check(
    "home API offline distinct from empty",
    await page.getByText("The market is unavailable.").isVisible(),
  );
  check(
    "API offline label visible on mobile",
    /api offline/i.test(await page.locator(".banner").innerText()),
  );
  await go("/gaps");
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  await mode("populated");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("searchbox").waitFor();
  check(
    "server route retry refreshes records",
    (await page.locator(".register-row").count()) === 3,
  );
  await go("/gaps/not-a-record");
  check(
    "record 404 distinct from offline",
    await page.getByRole("heading", { name: "This trail ends here." }).isVisible(),
  );
  // Keyboard focus, reduced motion, 200% zoom reflow and accessibility scans.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/");
  await page.keyboard.press("Tab");
  check(
    "keyboard skip link first",
    await page.evaluate(() => document.activeElement.classList.contains("skip-link")),
  );
  check(
    "focus visibly outlined",
    await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle !== "none",
    ),
  );
  await page.keyboard.press("Enter");
  check("skip reaches main", new URL(page.url()).hash === "#main");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await go("/");
  check(
    "reduced motion static story",
    await page
      .locator(".story-stage")
      .evaluate((e) => getComputedStyle(e).position === "static"),
  );
  check(
    "reduced motion removes animation",
    await page
      .locator(".cover-copy")
      .evaluate((e) => getComputedStyle(e).animationName === "none"),
  );
  await page.locator(".chapter-nav button").last().click();
  check(
    "chapter direct navigation",
    (await page.locator(".chapter-nav button").last().getAttribute("aria-current")) ===
      "step",
  );
  for (const [name, path] of routes) {
    await go(path);
    await page.evaluate(() => (document.documentElement.style.zoom = "2"));
    await noOverflow(`${name}: 200% CSS zoom reflow`);
    await page.evaluate(() => (document.documentElement.style.zoom = ""));
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [name, path] of routes) {
    await go(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    report.accessibility.push({
      route: name,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target),
      })),
    });
  }
  await go("/lab");
  await page.getByRole("button", { name: "Run this experiment" }).click();
  await page.getByText("Experiment complete.").waitFor();
  await page.getByRole("button", { name: "04 Allocation" }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  report.accessibility.push({
    route: "lab-populated",
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target),
    })),
  });
  // Local production measurements, not field Web Vitals.
  const perfContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const perf = await perfContext.newPage();
  await perf.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      window.__lcp = list.getEntries().at(-1).startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await perf.goto(base, { waitUntil: "networkidle" });
  await perf.evaluate(() => document.fonts.ready);
  report.metrics.home = await perf.evaluate(() => ({
    lcpMs: window.__lcp,
    fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
    resources: performance.getEntriesByType("resource").map((r) => ({
      name: new URL(r.name).pathname,
      transferBytes: r.transferSize,
      encodedBytes: r.encodedBodySize,
      decodedBytes: r.decodedBodySize,
    })),
    htmlTransferBytes: performance.getEntriesByType("navigation")[0].transferSize,
  }));
  await page.bringToFront();
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            window.__interaction = performance.now() - start;
          }),
        );
      },
      { once: true },
    );
  });
  await page.locator(".source-card").nth(1).click();
  await page.waitForFunction(() => window.__interaction !== undefined);
  report.metrics.sourceClickToSecondFrameMs = await page.evaluate(
    () => window.__interaction,
  );
  for (const [name, path, action] of [
    [
      "hero",
      "/",
      async (clip) => {
        await clip.getByRole("button", { name: "Replay motion" }).click();
        await clip.waitForTimeout(5500);
      },
    ],
    [
      "story",
      "/",
      async (clip) => {
        for (const title of ["01 Request", "02 Inspect", "03 Allocate", "04 Record"]) {
          await clip.getByRole("button", { name: title }).click();
          await clip.waitForTimeout(1100);
        }
      },
    ],
    [
      "lab",
      "/lab",
      async (clip) => {
        await clip.getByRole("button", { name: "Run this experiment" }).click();
        await clip.getByText("Experiment complete.").waitFor();
        await clip.getByRole("button", { name: "Replay from start" }).click();
        await clip.waitForTimeout(10500);
      },
    ],
  ]) {
    const clipContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: out, size: { width: 1440, height: 900 } },
    });
    const clip = await clipContext.newPage();
    await clip.goto(base + path, { waitUntil: "networkidle" });
    await action(clip);
    const video = clip.video();
    await clipContext.close();
    if (video) await video.saveAs(`${out}/motion-${name}.webm`);
  }
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto(base, { waitUntil: "networkidle" });
  for (const title of ["01 Request", "02 Inspect", "03 Allocate", "04 Record"]) {
    await mobile.getByRole("button", { name: title }).click();
    await mobile.waitForTimeout(1250);
    if (title === "03 Allocate")
      await mobile
        .locator(".story-stage")
        .screenshot({ path: `${out}/motion-story-mobile-allocate.png` });
  }
  const mobileVideo = mobile.video();
  await mobileContext.close();
  if (mobileVideo) await mobileVideo.saveAs(`${out}/motion-story-mobile.webm`);
  await perf.screenshot({ path: resolve(out, "../frontend-home.png") });
  await page.evaluate(() => {
    const dossier = document.querySelector(".lab-dossier");
    window.scrollTo({
      top: dossier.getBoundingClientRect().top + scrollY,
      behavior: "instant",
    });
  });
  await page
    .locator(".lab-dossier")
    .screenshot({ path: resolve(out, "../frontend-lab.png") });
  await perfContext.close();
  check(
    "zero unexpected page errors",
    report.errors.filter((e) => !e.includes("Server Components render")).length === 0,
  );
  check(
    "axe: no detected WCAG A/AA violations",
    report.accessibility.every((r) => r.violations.length === 0),
  );
} catch (e) {
  report.failure = e.message;
  console.error(e);
} finally {
  await mode("populated");
  await fs.writeFile(
    resolve(out, "../../frontend-review-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      checks: report.checks.length,
      passed: report.checks.filter((c) => c.passed).length,
      failure: report.failure,
      accessibility: report.accessibility,
      metrics: report.metrics,
    },
    null,
    2,
  ),
);
if (report.failure) process.exitCode = 1;
