import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS } from "../theme";

export const K = 1920 / 1440; // CSS px (recorded viewport) -> video px

export type Box = { x: number; y: number; width: number; height: number };

/** A slice of the real screen recording with a smooth push-in toward a point (video px). */
export const Clip: React.FC<{
  start: number; // source seconds
  rate?: number;
  zoom?: [number, number];
  origin?: [number, number]; // video px
  shift?: [number, number]; // optional pan in px over the clip [dx, dy]
  duration: number; // frames of this clip
  children?: React.ReactNode; // overlays in video px, they follow the zoom
}> = ({ start, rate = 1, zoom = [1, 1], origin = [960, 540], shift = [0, 0], duration, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = p * p * (3 - 2 * p);
  const z = zoom[0] + (zoom[1] - zoom[0]) * ease;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: C.deep }}>
      <AbsoluteFill style={{ transform: `translate(${shift[0] * ease}px, ${shift[1] * ease}px) scale(${z})`, transformOrigin: `${origin[0]}px ${origin[1]}px` }}>
        <OffthreadVideo src={staticFile("footage/journey.webm")} startFrom={Math.round(start * FPS)} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Quick gold highlight ring around a region (video px) that draws in and pulses. */
export const Highlight: React.FC<{ box: Box; delay?: number; hold?: number; pad?: number; label?: string }> = ({ box, delay = 0, hold = 60, pad = 14, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [delay + hold, delay + hold + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 1 + 0.012 * Math.sin((frame - delay) / 4);
  const o = Math.min(p, 1) * out;
  return (
    <div style={{ position: "absolute", left: box.x - pad, top: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2, opacity: o, transform: `scale(${(0.94 + 0.06 * Math.min(p, 1)) * pulse})`, border: `3px solid ${C.gold}`, borderRadius: 14, boxShadow: `0 0 0 9999px rgba(6,16,12,${0.38 * o}), 0 0 28px rgba(233,184,119,.6)`, pointerEvents: "none" }}>
      {label && <div style={{ position: "absolute", top: -50, left: 0, background: C.gold, color: C.deep, fontWeight: 600, fontSize: 26, padding: "6px 16px", borderRadius: 8, whiteSpace: "nowrap" }}>{label}</div>}
    </div>
  );
};

/** Lower-third caption. */
export const Caption: React.FC<{ kicker: string; text: string; delay?: number; duration: number; side?: "left" | "right" }> = ({ kicker, text, delay = 4, duration, side = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const out = interpolate(frame, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 64, [side]: 80, opacity: p * out, transform: `translateY(${(1 - p) * 24}px)`, background: "rgba(6,16,12,.82)", border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.gold}`, borderRadius: 12, padding: "18px 30px", maxWidth: 1000, backdropFilter: "blur(6px)" }}>
      <div style={{ color: C.gold, fontSize: 22, letterSpacing: 4, textTransform: "uppercase", fontWeight: 500 }}>{kicker}</div>
      <div style={{ color: C.cream, fontSize: 40, fontWeight: 600, letterSpacing: -1, marginTop: 4 }}>{text}</div>
    </div>
  );
};
