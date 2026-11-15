// Renders the final demo (29.8 s) with the AI disclosure embedded as MP4 metadata. Run: npm run render
import { spawnSync } from "node:child_process";

const meta = {
  title: "Heirloom: What should I plant next? (NASA Space Apps 2026, Field Shift)",
  artist: "Heirloom team",
  description:
    "Real app screens (Jesús Carranza case). Data: NASA POWER (climate), SoilGrids 2.0 ISRIC CC BY 4.0 (soil). Map imagery © Mapbox © OpenStreetMap © Maxar. " +
    "AI-generated visuals (labelled on screen): code-generated animation by Claude Code (Remotion); logo generated with ChatGPT (OpenAI).",
  comment:
    "Generated audio: narration: synthetic voice, Kokoro-82M (hexgrad, Apache-2.0) via kokoro-onnx, af_heart+af_kore blend; " +
    "music and sound effects: synthesized by a NumPy script written with Claude Code (no music model, no samples). Code and edit assisted by Claude Code (Anthropic).",
};
const args = ["node_modules/@remotion/cli/remotion-cli.js", "render", "HeirloomDemo", "out/heirloom-demo.mp4", "--codec", "h264", "--crf", "18"];
for (const [k, v] of Object.entries(meta)) args.push("--metadata", `${k}=${v}`);
const r = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(r.status ?? 1);
