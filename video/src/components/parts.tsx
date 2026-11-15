import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "../theme";

/** Fade/slide in progress 0..1 starting at `delay` frames. */
export const useIn = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** Gold contour background with slow drift. */
export const Background: React.FC<{ dusk?: boolean }> = ({ dusk }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily }}>
      {dusk && <Img src={staticFile("hero-dusk.svg")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />}
      <Img src={staticFile("contours-flow-tile.svg")} style={{ position: "absolute", left: -frame * 0.6, top: 0, width: 2600, height: "100%", objectFit: "cover", opacity: dusk ? 0.35 : 0.5 }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(11,21,17,0) 0%, rgba(6,16,12,.75) 100%)" }} />
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const p = useIn(delay);
  return (
    <div style={{ color: C.gold, letterSpacing: 5, fontSize: 24, fontWeight: 500, textTransform: "uppercase", opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
      {children}
    </div>
  );
};

/** Word-by-word headline reveal. */
export const Headline: React.FC<{ text: string; size?: number; delay?: number; color?: string; maxWidth?: number }> = ({ text, size = 84, delay = 0, color = C.cream, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontSize: size, lineHeight: 1.05, fontWeight: 600, letterSpacing: -2, color, maxWidth, display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.26}px` }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * 4, fps, config: { damping: 200 } });
        return (
          <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 34}px)`, display: "inline-block" }}>{w}</span>
        );
      })}
    </div>
  );
};

export const Sub: React.FC<{ children: React.ReactNode; delay?: number; size?: number; maxWidth?: number }> = ({ children, delay = 0, size = 32, maxWidth }) => {
  const p = useIn(delay);
  return <div style={{ color: C.muted, fontSize: size, lineHeight: 1.35, maxWidth, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>{children}</div>;
};

/** Browser-like frame around a real screenshot with a slow push-in. */
export const Shot: React.FC<{ src: string; width: number; delay?: number; zoom?: [number, number]; origin?: string; duration: number }> = ({ src, width, delay = 0, zoom = [1, 1.08], origin = "50% 40%", duration }) => {
  const frame = useCurrentFrame();
  const p = useIn(delay, 18);
  const z = interpolate(frame, [0, duration], zoom, { extrapolateRight: "clamp" });
  const height = (width * 1080) / 1920;
  return (
    <div style={{ width, borderRadius: 18, overflow: "hidden", border: `1px solid ${C.line}`, background: C.deep, boxShadow: "0 40px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(233,184,119,.12)", opacity: p, transform: `translateY(${(1 - p) * 60}px) scale(${0.96 + 0.04 * p})` }}>
      <div style={{ height: 38, background: "#101C16", display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {["#A4523A", "#E6C877", "#9DBE8C"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.8 }} />)}
        <span style={{ marginLeft: 16, color: C.muted, fontSize: 15 }}>heirloom</span>
      </div>
      <div style={{ width, height, overflow: "hidden" }}>
        <Img src={staticFile(`shots/${src}`)} style={{ width, height, transform: `scale(${z})`, transformOrigin: origin }} />
      </div>
    </div>
  );
};

/** Card crop (no browser chrome), full-width. */
export const Card: React.FC<{ src: string; width: number; delay?: number }> = ({ src, width, delay = 0 }) => {
  const p = useIn(delay, 18);
  return (
    <Img src={staticFile(`shots/${src}`)} style={{ width, borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 30px 90px rgba(0,0,0,.55)", opacity: p, transform: `translateY(${(1 - p) * 50}px)` }} />
  );
};

export const Pill: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({ children, delay = 0, color = C.gold }) => {
  const p = useIn(delay, 14);
  return (
    <div style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, border: `2px solid ${color}`, color, background: "rgba(11,21,17,.85)", fontSize: 34, fontWeight: 500, opacity: p, transform: `scale(${0.8 + 0.2 * p})` }}>{children}</div>
  );
};

export const BigNumber: React.FC<{ from: number; to: number; delay?: number; size?: number; color?: string }> = ({ from, to, delay = 0, size = 150, color = C.goldSoft }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = from + (to - from) * p;
  return <span style={{ fontSize: size, fontWeight: 600, letterSpacing: -4, color }}>{v.toFixed(1)}</span>;
};

export const Fade: React.FC<{ children: React.ReactNode; duration: number }> = ({ children, duration }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};
