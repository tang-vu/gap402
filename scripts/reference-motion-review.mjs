// Optional reference inspection. Playwright stays outside application dependencies.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import fs from "node:fs/promises";
const require = createRequire(process.env.UI_QA_PACKAGE ?? resolve("package.json"));
const { chromium } = require("playwright");
const output = resolve(process.env.UI_OUTPUT ?? "docs/images/reference-motion");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const observations = [];
for (const [name, url] of [
  ["bearplus", "https://bear.plus/"],
  ["silana", "https://www.silana.com/"],
  ["heronai", "https://heronaiapp.com/"],
  ["unitedcarriers", "https://unitedcarriers.com/"],
]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: output, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const observation = { name, url, status: "unavailable", title: "", frames: [] };
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    observation.status = String(response?.status() ?? "no response");
    observation.title = await page.title();
    await page.waitForTimeout(1600);
    for (const [index, fraction] of [0, 0.3, 0.65, 1].entries()) {
      await page.evaluate(
        (part) =>
          scrollTo({
            top: (document.documentElement.scrollHeight - innerHeight) * part,
            behavior: "smooth",
          }),
        fraction,
      );
      await page.waitForTimeout(1400);
      const path = `${output}/${name}-${index}.png`;
      await page.screenshot({ path });
      observation.frames.push(path);
    }
  } catch (error) {
    observation.error = error instanceof Error ? error.message : String(error);
  }
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${output}/${name}.webm`);
  observations.push(observation);
}
await fs.writeFile(`${output}/observations.json`, JSON.stringify(observations, null, 2));
await browser.close();
console.log(JSON.stringify(observations, null, 2));
