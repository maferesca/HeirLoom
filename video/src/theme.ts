import { loadFont as loadNormal } from "@remotion/google-fonts/InstrumentSans";

export const { fontFamily } = loadNormal("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const C = {
  bg: "#0B1511", deep: "#06100C", cream: "#F1EDE2", muted: "#A8B5AC", gold: "#E9B877", goldSoft: "#F6D9A3",
  terra: "#A4523A", maize: "#E6C877", bean: "#9DBE8C", line: "rgba(241,237,226,.14)",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const TOTAL = 894; // 29.8 s (export must be 30 s or less)
