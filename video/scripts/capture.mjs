// Captures real screenshots of the running Heirloom app (English, Jesus Carranza case) for the promo video.
// Requires: engine on :8000 and web on :3000.  Run: npm run capture
import { chromium } from "playwright";

const BASE = process.env.HEIRLOOM_URL ?? "http://localhost:3000/en";
const OUT = "public/shots";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const el = async (selector, name) => { await page.locator(selector).first().screenshot({ path: `${OUT}/${name}.png` }); console.log("element", name); };
const scrollTo = async (selector, offset = 0) => {
  await page.evaluate(([s, o]) => { const e = document.querySelector(s); window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY + o, behavior: "instant" }); }, [selector, offset]);
  await sleep(1800);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await shot("01-hero");

await page.getByRole("button", { name: /Try the Jes/ }).click();
await page.waitForSelector("#results article", { timeout: 240000 });
await sleep(8000);

await scrollTo("#map-section", -10);
await sleep(3000);
await shot("02-map");

await scrollTo("#known", 40);
await sleep(3500);
await shot("03-climate");
await el("#known svg", "03b-chart-sep");
await page.getByRole("radio", { name: /^March/ }).click();
await sleep(600);
await el("#known svg", "03c-chart-mar");

await scrollTo("#ask", 0);
await sleep(1500);
await shot("04-answers");
await el(".answers", "04b-answers-bar");

await scrollTo("#results", 0);
await shot("05-results");
await scrollTo("#results article:nth-of-type(2)", -30);
await shot("06-alternative");
await el("#results article:nth-of-type(2)", "06b-card");

// move the simulator: rain 80 %
await page.getByRole("button", { name: /Start simulator/ }).click();
await sleep(500);
const rain = page.locator('input[type=range]').nth(1);
await rain.evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, "80"); e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForFunction(() => document.body.innerText.includes("Adjusted:"), null, { timeout: 240000 });
await sleep(1500);
await scrollTo("#results article:nth-of-type(2)", -30);
await shot("07-scenario");
await el("#results article:nth-of-type(2)", "07b-card-scenario");
await scrollTo("#between", -30);
await shot("08-between");
await el("#between", "08b-between");

await browser.close();
console.log("done");
