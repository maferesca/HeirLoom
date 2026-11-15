// Renders the Earth -> Jesus Carranza punch-in as a PNG sequence with Mapbox GL (same satellite style as the app's map).
// Uses the app's own token (web/.env.local) and the app's local mapbox-gl build; served on localhost so URL restrictions pass.
// Output: public/globe/0000.png ... Run: node scripts/globe.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const env = fs.readFileSync("../web/.env.local", "utf8");
const token = env.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(\S+)/)[1];
const OUT = "public/globe";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const FRAMES = Number(process.env.FRAMES ?? 75);
const TARGET = [-95.02336, 17.432993];

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="/__mb/mapbox-gl.css" rel="stylesheet"><script src="/__mb/mapbox-gl.js"></script>
<style>html,body,#m{margin:0;width:100%;height:100%;background:#06100C}.mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{opacity:.55}</style></head>
<body><div id="m"></div><script>
mapboxgl.accessToken = ${JSON.stringify(token)};
window.map = new mapboxgl.Map({ container: "m", style: "mapbox://styles/mapbox/satellite-streets-v12", projection: "globe",
  center: [-60, 12], zoom: 1.35, interactive: false, fadeDuration: 0, attributionControl: true });
map.on("style.load", () => { map.setFog({ color: "rgb(30,40,32)", "high-color": "rgb(233,184,119)", "horizon-blend": 0.04, "space-color": "rgb(6,16,12)", "star-intensity": 0.35 }); window.ready = true; });
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route("http://localhost:3000/__globe", (r) => r.fulfill({ contentType: "text/html", body: html }));
await page.route("http://localhost:3000/__mb/*", (r) => {
  const f = r.request().url().split("/").pop();
  r.fulfill({ contentType: f.endsWith(".css") ? "text/css" : "application/javascript", body: fs.readFileSync(`../web/node_modules/mapbox-gl/dist/${f}`) });
});
await page.goto("http://localhost:3000/__globe");
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
for (let i = 0; i < FRAMES; i++) {
  const t = i / (FRAMES - 1);
  // 0-0.3: the whole Earth turning; 0.3-1: punch in to the locality
  const spin = Math.min(1, t / 0.3);
  const k = ease(Math.max(0, (t - 0.3) / 0.7));
  const startLng = -60 + (-80 - -60) * spin;
  const startLat = 12 + (16 - 12) * spin;
  const lng = startLng + (TARGET[0] - startLng) * Math.min(1, k * 1.6);
  const lat = startLat + (TARGET[1] - startLat) * Math.min(1, k * 1.6);
  const zoom = 1.35 + (12.4 - 1.35) * Math.pow(k, 1.6);
  await page.evaluate(([lng, lat, zoom]) => new Promise((res) => {
    map.jumpTo({ center: [lng, lat], zoom });
    const done = () => res();
    map.once("idle", done);
    setTimeout(done, 12000);
  }), [lng, lat, zoom]);
  await page.screenshot({ path: `${OUT}/${String(i).padStart(4, "0")}.png` });
  if (i % 10 === 0) console.log("frame", i, zoom.toFixed(2));
}
await browser.close();
console.log("done");
