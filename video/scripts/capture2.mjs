// Second set of real app captures for the cinematic ad (no cursor, no scrolling visible, no browser chrome).
// Base run = Jesus Carranza case, maize and dry bean both available. Then "I have no buyer for: Dry bean" is checked
// and the comparison is run again for the before/after. Output: public/shots2/*.png and public/shots2/facts.json.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.HEIRLOOM_URL ?? "http://localhost:3000/en";
const OUT = "public/shots2";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const facts = {};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const el = async (loc, name) => { await loc.scrollIntoViewIfNeeded(); await sleep(900); await loc.screenshot({ path: `${OUT}/${name}.png` }); console.log("element", name); };
const scrollTo = async (selector, offset = 0, nth = 0) => {
  await page.evaluate(([s, o, n]) => { const e = document.querySelectorAll(s)[n]; window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY + o, behavior: "instant" }); }, [selector, offset, nth]);
  await sleep(1800);
};
const articleNames = () => page.$$eval("#results article", (as) => as.map((a) => a.innerText.split("\n").slice(0, 8).join(" | ")));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Try the Jes/ }).click();
await page.waitForSelector("#results article", { timeout: 240000 });
await sleep(6000);

// the place
await scrollTo("#map-section", -10);
await sleep(2500);
await shot("map");

// climate with its source label
await scrollTo("#known", 40);
await sleep(3000);
const src = page.locator("#known summary", { hasText: "View source" }).first();
await src.click();
await sleep(800);
await el(page.locator("#known svg").first(), "chart");
await el(src.locator(".."), "chart-source");
await scrollTo("#known", 40);
await shot("climate");

// soil: SoilGrids regional estimate (card + profile table)
const soilCard = page.locator(".calm", { has: page.getByText("Regional estimate (SoilGrids)", { exact: true }) }).first();
await el(soilCard, "soil-card");
const soilTable = page.locator("table").filter({ hasText: "Clay" }).first().locator("xpath=ancestor::div[contains(@class,'mt-2')][1]");
await el(soilTable, "soil-table");

// crop history
const hist = page.locator(".calm", { has: page.getByText("What have you planted in recent cycles?") }).first();
await el(hist, "history");
await el(page.locator(".answers").first(), "answers-bar");

// results: heading, current practice, alternative 1, between
await scrollTo("#results", 0);
await shot("results-head");
await el(page.locator("#results article").nth(0), "current");
await el(page.locator("#results article").nth(1), "alt1");
await el(page.locator("#between"), "between");
await scrollTo("#results article", -30, 1);
await shot("options-before");
facts.before = await articleNames();

// constraint: no buyer for dry bean
const q4 = page.locator("fieldset", { hasText: "What can or do you want to plant?" }).first();
await el(q4, "constraint-before");
const buyerRow = q4.locator("div", { hasText: "I have no buyer for:" }).last();
await buyerRow.getByLabel("Dry bean").check();
await sleep(500);
await el(q4, "constraint-after");
await page.getByRole("button", { name: "Compare rotations" }).click();
await page.waitForFunction(() => /no buyer for/i.test(document.querySelector("#results")?.innerText ?? ""), null, { timeout: 240000 });
await sleep(3000);
await scrollTo("#results article", -30, 1).catch(() => {});
await scrollTo("#results", 0);
await shot("options-after-head");
facts.after = await articleNames();
const dropped = page.locator("section,div", { has: page.getByText("Options that do not appear and why") }).last();
await el(dropped, "dropped");
fs.writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 2));
await browser.close();
console.log("done");
