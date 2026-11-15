// Records real screen footage of the running Heirloom app (Jesus Carranza case) with a visible cursor and smooth scrolling.
// Writes public/footage/journey.webm and public/footage/marks.json (timestamps in seconds + element boxes in CSS px, viewport 1440x810).
// Requires engine on :8000 and web on :3000.  Run: npm run record
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.HEIRLOOM_URL ?? "http://localhost:3000/en";
const DIR = "public/footage";
fs.mkdirSync(DIR, { recursive: true });
fs.rmSync(`${DIR}/_tmp`, { recursive: true, force: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, recordVideo: { dir: `${DIR}/_tmp`, size: { width: 1440, height: 810 } } });
await ctx.addInitScript(() => {
  const mk = () => {
    if (document.getElementById("__cur")) return;
    const d = document.createElement("div");
    d.id = "__cur";
    d.style.cssText = "position:fixed;left:-50px;top:-50px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #E9B877;background:rgba(233,184,119,.35);z-index:2147483647;pointer-events:none;box-shadow:0 0 0 2px rgba(0,0,0,.35)";
    document.documentElement.appendChild(d);
    addEventListener("mousemove", (e) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, true);
  };
  addEventListener("DOMContentLoaded", mk);
});
const page = await ctx.newPage();
const t0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = {};
const mark = async (name, selector, nth = 0) => {
  const m = { t: (Date.now() - t0) / 1000 };
  if (selector) { try { m.box = await page.locator(selector).nth(nth).boundingBox({ timeout: 2000 }); } catch {} }
  marks[name] = m;
  console.log("mark", name, m.t.toFixed(1));
};
const scrollToY = (y, ms) => page.evaluate(([y, ms]) => new Promise((res) => {
  const s = window.scrollY, d = y - s, t = performance.now();
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const f = (now) => { const p = Math.min(1, (now - t) / ms); window.scrollTo(0, s + d * ease(p)); p < 1 ? requestAnimationFrame(f) : res(); };
  requestAnimationFrame(f);
}), [y, ms]);
const scrollToEl = async (selector, offset = 0, ms = 1400, nth = 0) => {
  const y = await page.evaluate(([s, o, n]) => { const e = document.querySelectorAll(s)[n]; return e.getBoundingClientRect().top + window.scrollY + o; }, [selector, offset, nth]);
  await scrollToY(Math.max(0, y), ms);
};
const moveTo = async (loc, steps = 30) => {
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
};

// 1. hero (the field)
await page.goto(BASE, { waitUntil: "networkidle" });
await page.mouse.move(1000, 500);
await sleep(1500);
await mark("hero");
await scrollToY(160, 3500);
await sleep(400);
await scrollToY(0, 1200);
await sleep(500);

// 2. load the case (the app computes; this wait is cut in the edit)
const btn = page.getByRole("button", { name: /Try the Jes/ });
await moveTo(btn);
await sleep(300);
await mark("click-case", null);
await btn.click();
await page.waitForSelector("#results article", { timeout: 240000 });
await sleep(4000);
await mark("loaded");

// 3. the place
await scrollToEl("#map-section", -10, 1800);
await sleep(300);
await mark("map", "#map-section");
await page.mouse.move(700, 420, { steps: 20 });
await sleep(2200);

// 4. climate (NASA POWER)
await scrollToEl("#known", 40, 1800);
await sleep(600);
await mark("climate", "#known svg");
const mar = page.getByRole("radio", { name: /^March/ });
await moveTo(mar, 35);
await mar.click();
await sleep(1600);
await mark("climate-march", "#known svg");
await moveTo(page.getByRole("radio", { name: /^September/ }), 25);
await page.getByRole("radio", { name: /^September/ }).click();
await sleep(900);

// 5. what the farmer knows: crop history + "?" guide
await scrollToEl("#ask", 0, 1800);
await sleep(500);
await mark("answers", "#ask");
const selects = page.locator("#ask select");
const n = await selects.count();
for (const i of [0, 3, 6].filter((i) => i < n)) {
  const s = selects.nth(i);
  await moveTo(s, 22);
  const v = await s.inputValue();
  await s.selectOption(v);
  await sleep(450);
}
await mark("history-done", "#ask");
const help = page.locator("#ask .help-btn").first();
await scrollToEl("#ask .help-btn", -330, 1600);
await sleep(300);
await moveTo(help, 30);
await mark("help-btn", "#ask .help-btn");
await help.click();
await sleep(900);
await mark("help-open", "#ask .help-panel");
await sleep(2600);
await page.keyboard.press("Escape");
await sleep(500);

// 6. the options
await scrollToEl("#results", 0, 1800);
await sleep(700);
await mark("results");
await sleep(1500);
await scrollToEl("#results article", -30, 1600, 1);
await sleep(600);
await mark("card", "#results article:nth-of-type(2)");
await sleep(2500);
await scrollToEl("#between", -30, 1800);
await sleep(600);
await mark("between", "#between");
await sleep(3000);

// 7. what if it rains less
await scrollToEl("#results article", -30, 1600, 1);
await sleep(500);
await page.getByRole("button", { name: /Start simulator/ }).click();
await sleep(700);
const rain = page.locator("input[type=range]").nth(1);
await rain.scrollIntoViewIfNeeded();
await page.evaluate(() => { const r = document.querySelectorAll("input[type=range]")[1]; window.scrollBy(0, r.getBoundingClientRect().top - 330); });
await sleep(900);
await mark("slider", "input[type=range] >> nth=1");
const b = await rain.boundingBox();
const xAt = (v) => b.x + 8 + (b.width - 16) * ((v - 70) / 60);
await page.mouse.move(xAt(100), b.y + b.height / 2, { steps: 30 });
await sleep(400);
await page.mouse.down();
await mark("drag-start", "input[type=range] >> nth=1");
for (let i = 0; i <= 40; i++) { await page.mouse.move(xAt(100 - i * 0.5), b.y + b.height / 2); await sleep(40); }
await page.mouse.up();
await rain.focus();
let rv = Number(await rain.inputValue());
while (rv !== 80) { await page.keyboard.press(rv < 80 ? "ArrowRight" : "ArrowLeft"); rv += rv < 80 ? 1 : -1; await sleep(250); }
await mark("drag-end", "input[type=range] >> nth=1");
await page.waitForFunction(() => document.body.innerText.includes("Adjusted:"), null, { timeout: 240000 });
await sleep(1200);
await mark("adjusted");
await scrollToEl("#results article", -30, 1400, 1);
await sleep(600);
await mark("adjusted-card", "#results article:nth-of-type(2)");
{
  const txt = await page.locator("#results article").nth(1).innerText();
  const m = txt.match(/Baseline:\s*([\d.]+)\/100\s*·?\s*Adjusted:\s*([\d.]+)\/100\s*\(([^)]+)\)/);
  marks.result = { rain: rv, baseline: m?.[1], adjusted: m?.[2], delta: m?.[3] };
  console.log("result", JSON.stringify(marks.result));
}
await sleep(2500);
await mark("end");

await ctx.close();
const vid = fs.readdirSync(`${DIR}/_tmp`).find((f) => f.endsWith(".webm"));
fs.renameSync(`${DIR}/_tmp/${vid}`, `${DIR}/journey.webm`);
fs.rmSync(`${DIR}/_tmp`, { recursive: true, force: true });
fs.writeFileSync(`${DIR}/marks.json`, JSON.stringify(marks, null, 2));
await browser.close();
console.log("done");
