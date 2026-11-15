import React from "react";
import { AbsoluteFill, getStaticFiles, Img, interpolate, OffthreadVideo, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

export type R = [number, number, number, number]; // x, y, w, h in canvas px

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Content area where shots are framed (below the centered title). */
const AREA = { cx: 960, cy: 600, w: 1760, h: 820 };

/**
 * Virtual camera over a canvas (one or more real screenshots). It frames `from` and eases to `to`
 * so the region fits the content area. `overlay` gets a mapper canvas->screen for highlights that keep a constant stroke.
 */
export const Cam: React.FC<{
  w: number; h: number; from: R; to?: R; dur: number; delay?: number; area?: typeof AREA;
  children: React.ReactNode; overlay?: (map: (r: R) => R) => React.ReactNode;
}> = ({ w, h, from, to, dur, delay = 0, area = AREA, children, overlay }) => {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [delay, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const t = to ?? from;
  const r: R = [lerp(from[0], t[0], p), lerp(from[1], t[1], p), lerp(from[2], t[2], p), lerp(from[3], t[3], p)];
  const s = Math.min(area.w / r[2], area.h / r[3]);
  const tx = area.cx - (r[0] + r[2] / 2) * s;
  const ty = area.cy - (r[1] + r[3] / 2) * s;
  const map = (b: R): R => [tx + b[0] * s, ty + b[1] * s, b[2] * s, b[3] * s];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: "0 0" }}>
        {children}
      </div>
      {overlay?.(map)}
    </AbsoluteFill>
  );
};

export const Pic: React.FC<{ src: string; x?: number; y?: number; w: number; h: number; style?: React.CSSProperties }> = ({ src, x = 0, y = 0, w, h, style }) => (
  <Img src={staticFile(src)} style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }} />
);

/** Screen-space highlight ring (box already mapped to screen). */
export const Ring: React.FC<{ box: R; delay?: number; hold?: number; label?: string; labelBelow?: boolean; dim?: boolean }> = ({ box, delay = 0, hold = 9999, label, labelBelow, dim = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(1, spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 160 } }));
  const out = interpolate(frame, [delay + hold, delay + hold + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = p * out;
  const pad = 12;
  const [x, y, w, h] = box;
  return (
    <div style={{ position: "absolute", left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2, opacity: o, transform: `scale(${0.96 + 0.04 * p})`, border: `3px solid ${C.gold}`, borderRadius: 14, boxShadow: `0 0 0 9999px rgba(6,16,12,${dim ? 0.45 * o : 0}), 0 0 30px rgba(233,184,119,.55)`, pointerEvents: "none" }}>
      {label && (
        <div style={{ position: "absolute", [labelBelow ? "bottom" : "top"]: -54, left: -3, background: C.gold, color: C.deep, fontWeight: 600, fontSize: 28, padding: "6px 16px", borderRadius: 8, whiteSpace: "nowrap" }}>{label}</div>
      )}
    </div>
  );
};

/** Short centered title above the shot. */
export const Title: React.FC<{ kicker?: string; text: string; delay?: number; size?: number }> = ({ kicker, text, delay = 2, size = 52 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 190, background: "linear-gradient(180deg, rgba(6,16,12,.95) 55%, rgba(6,16,12,0))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: p, transform: `translateY(${(1 - p) * -14}px)` }}>
      {kicker && <div style={{ color: C.gold, fontSize: 22, letterSpacing: 5, fontWeight: 500, textTransform: "uppercase" }}>{kicker}</div>}
      <div style={{ color: C.cream, fontSize: size, fontWeight: 600, letterSpacing: -1, textAlign: "center" }}>{text}</div>
    </div>
  );
};

export const ShotBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Img src={staticFile("contours-flow-tile.svg")} style={{ position: "absolute", left: -frame * 0.5, top: 0, width: 2600, height: "100%", objectFit: "cover", opacity: 0.35 }} />
    </AbsoluteFill>
  );
};

const hasFarmer = () => {
  try { return getStaticFiles().some((f) => f.name === "farmer.mp4"); } catch { return false; }
};

/**
 * Seed over soil. Uses public/farmer.mp4 when present (real footage of a farmer's hand); otherwise an illustrated
 * close-up: a maize seed lowering toward a furrow. `planted` shows the seed in the furrow with a sprout (closing shot).
 */
export const Seed: React.FC<{ dur: number; planted?: boolean; videoStart?: number }> = ({ dur, planted, videoStart = 0 }) => {
  const frame = useCurrentFrame();
  if (hasFarmer()) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <OffthreadVideo src={staticFile("farmer.mp4")} startFrom={videoStart} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  const p = frame / dur;
  const zoom = planted ? 1.06 - 0.06 * p : 1 + 0.08 * p;
  const seedY = planted ? 640 : 380 + 120 * ease(Math.min(1, p * 1.1));
  const sprout = planted ? ease(Math.min(1, p * 1.3)) : 0;
  const motes = Array.from({ length: 26 }, (_, i) => {
    const x = random(`mx${i}`) * 1920;
    const y = 120 + random(`my${i}`) * 520 - frame * (0.3 + random(`mv${i}`) * 0.6);
    const r = 1.5 + random(`mr${i}`) * 3;
    return <circle key={i} cx={x} cy={((y % 700) + 700) % 700 + 60} r={r} fill="#F6D9A3" opacity={0.15 + random(`mo${i}`) * 0.35} />;
  });
  return (
    <AbsoluteFill style={{ background: "#0A0806", overflow: "hidden" }}>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ transform: `scale(${zoom})`, transformOrigin: "50% 60%" }}>
        <defs>
          <radialGradient id="sky" cx="68%" cy="18%" r="80%">
            <stop offset="0" stopColor="#6B4A24" /><stop offset=".45" stopColor="#24180D" /><stop offset="1" stopColor="#090705" />
          </radialGradient>
          <filter id="soilTex" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="4" seed="4" result="n" />
            <feColorMatrix in="n" type="matrix" values="0.42 0 0 0 0.04  0.27 0 0 0 0.02  0.15 0 0 0 0.008  0 0 0 0 1" />
          </filter>
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer></filter>
          <linearGradient id="soilLight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9B877" stopOpacity=".35" /><stop offset=".5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".7" />
          </linearGradient>
          <radialGradient id="kernel" cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#FFF1C8" /><stop offset=".35" stopColor="#F2C45C" /><stop offset="1" stopColor="#A86A1C" />
          </radialGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#F6D9A3" stopOpacity=".45" /><stop offset="1" stopColor="#F6D9A3" stopOpacity="0" /></radialGradient>
          <clipPath id="ground"><path d="M0 600 C 300 560 560 640 820 650 C 900 653 1020 653 1100 650 C 1360 640 1620 560 1920 600 L1920 1080 L0 1080 Z" /></clipPath>
        </defs>
        <rect width="1920" height="1080" fill="url(#sky)" />
        <g clipPath="url(#ground)">
          <rect width="1920" height="1080" filter="url(#soilTex)" />
          <rect width="1920" height="1080" fill="url(#soilLight)" />
          <path d="M760 648 C 860 700 1060 700 1160 648" stroke="#000" strokeOpacity=".5" strokeWidth="26" fill="none" />
        </g>
        <ellipse cx="960" cy={seedY - 10} rx="160" ry="160" fill="url(#glow)" />
        {sprout > 0 && (
          <g transform={`translate(960 ${seedY - 30}) scale(${sprout})`}>
            <path d="M0 0 C 2 -60 -4 -110 0 -150" stroke="#9DBE8C" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M0 -120 C -60 -150 -110 -130 -130 -95 C -80 -90 -30 -100 0 -120 Z" fill="#9DBE8C" />
            <path d="M0 -140 C 50 -185 105 -175 125 -140 C 80 -130 35 -130 0 -140 Z" fill="#B7D3A4" />
          </g>
        )}
        <g transform={`translate(960 ${seedY}) rotate(${planted ? 8 : -14 + 10 * p})`}>
          <path d="M0 -58 C 34 -56 46 -20 40 14 C 34 44 14 58 0 58 C -14 58 -34 44 -40 14 C -46 -20 -34 -56 0 -58 Z" fill="url(#kernel)" />
          <path d="M-14 -30 C -6 -40 10 -40 16 -30" stroke="#FFF7DE" strokeOpacity=".8" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        {motes}
        <rect width="1920" height="1080" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 40%, rgba(0,0,0,.6) 100%)" }} />
    </AbsoluteFill>
  );
};
