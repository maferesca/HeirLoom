import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background, BigNumber, Headline, Kicker, Sub, useIn } from "./components/parts";
import { Caption, Clip, Highlight, K } from "./components/footage";
import marks from "../public/footage/marks.json";
import { C, fontFamily } from "./theme";

// Timeline (30 fps): 0-4 s question | 4-9 s place + NASA POWER | 9-15 s what the farmer knows |
// 15-24 s the options | 24-30 s what if it rains less + close.
const M = marks as unknown as Record<string, { t: number; box?: { x: number; y: number; width: number; height: number } }>;
const px = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x * K, y: b.y * K, width: b.width * K, height: b.height * K });

/** Sequence with a short dissolve-in so shots overlap smoothly. */
const Seq: React.FC<{ from: number; dur: number; fade?: number; children: React.ReactNode }> = ({ from, dur, fade = 6, children }) => {
  const f = from === 0 ? 0 : fade;
  return (
    <Sequence from={from - f} durationInFrames={dur + f}>
      <Dissolve frames={f}>{children}</Dissolve>
    </Sequence>
  );
};
const Dissolve: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const o = frames ? interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" }) : 1;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const card = px(M["card"].box!); // card box in video px (scrolled to -30)
const cardRel = (x: number, y: number, w: number, h: number) => ({ x: card.x + x, y: card.y + y, width: w, height: h });
const betweenRow = { x: 160, y: 440, width: 1600, height: 125 };
const gap240 = { x: 1100, y: 445, width: 455, height: 62 };
const sliderBox = px(M["slider"].box!);
const R = (marks as any).result as { rain: number; baseline: string; adjusted: string; delta: string };
const dragRate = Math.max(1, (M["drag-end"].t - M["drag-start"].t + 0.8) / (80 / 30));

const music = (f: number) => {
  // low bed; gentle lift as the planting options appear (15 s) and a fade-out
  const base = interpolate(f, [0, 30, 420, 480, 720, 840, 900], [0, 0.22, 0.24, 0.34, 0.3, 0.26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return base;
};

export const HeirloomDemo: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily }}>
    <Audio src={staticFile("music.wav")} volume={music} />

    {/* 0-4 s  The question */}
    <Seq from={0} dur={120}>
      <Clip start={M["hero"].t} duration={120} zoom={[2.0, 2.25]} origin={[1920, 620]} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(6,16,12,.55), rgba(6,16,12,.15) 45%, rgba(6,16,12,.6))" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 160px" }}>
        <FadeOut from={96} to={116}>
          <Headline text="How do you decide what to plant next?" size={112} delay={12} maxWidth={1500} />
        </FadeOut>
      </AbsoluteFill>
    </Seq>

    {/* 4-9 s  The place, then the climate (NASA POWER) */}
    <Seq from={120} dur={60}>
      <Clip start={M["loaded"].t + 0.4} duration={60} zoom={[1, 1.05]} origin={[960, 540]} />
      <Caption kicker="Your place" text="Jesús Carranza, Veracruz" duration={60} />
    </Seq>
    <Seq from={180} dur={90}>
      <Clip start={M["climate"].t - 1.2} duration={90} zoom={[1, 1.1]} origin={[760, 640]}>
      <Highlight box={px(M["climate"].box!)} delay={28} hold={50} />
      </Clip>
      <Caption kicker="NASA POWER · 2005–2024" text="Rainfall and temperature, month by month" duration={90} />
    </Seq>

    {/* 9-15 s  What the farmer knows */}
    <Seq from={270} dur={90}>
      <Clip start={M["answers"].t - 0.9} duration={90} zoom={[1, 1.07]} origin={[800, 420]} />
      <Caption kicker="What only you know" text="Your crop history, in your own words" duration={90} />
    </Seq>
    <Seq from={360} dur={90}>
      <Clip start={M["help-btn"].t - 0.4} duration={90} zoom={[1, 1.12]} origin={[900, 640]}>
      <Highlight box={px(M["help-btn"].box!)} delay={8} hold={26} pad={22} />
      <Highlight box={px(M["help-open"].box!)} delay={50} hold={34} />
      </Clip>
      <Caption kicker="Not sure?" text="Tap ? to see what to look for in your field" duration={90} />
    </Seq>

    {/* 15-24 s  The options (most screen time) */}
    <Seq from={450} dur={40}>
      <Clip start={M["results"].t - 0.7} duration={40} zoom={[1, 1.04]} origin={[960, 300]} />
    </Seq>
    <Seq from={490} dur={140}>
      <Clip start={M["card"].t - 2.2} duration={140} zoom={[1, 1.18]} origin={[card.x + 700, card.y + 330]}>
      <Highlight box={cardRel(238, 20, 1362, 78)} delay={62} hold={34} label="Dry bean → Maize → Dry bean" />
      <Highlight box={cardRel(238, 176, 800, 70)} delay={104} hold={30} label="Why this option appears" />
      </Clip>
      <Caption kicker="What to plant each cycle" text="A corn-and-bean rotation, and why it is shown" duration={140} />
    </Seq>
    <Seq from={630} dur={90}>
      <Clip start={M["between"].t - 1.4} duration={90} zoom={[1, 1.06]} origin={[960, 480]}>
      <Highlight box={gap240} delay={46} hold={36} label="240 days between harvest and planting" />
      <Highlight box={betweenRow} delay={36} hold={10} pad={6} />
      </Clip>
      <Caption kicker="Between harvest and planting" text="See the time the field has no crop" duration={90} />
    </Seq>

    {/* 24-30 s  What if it rains less? */}
    <Seq from={720} dur={80}>
      <Clip start={M["drag-start"].t - 0.4} rate={dragRate} duration={80} zoom={[1, 1.12]} origin={[sliderBox.x + 300, sliderBox.y + 40]}>
      <Highlight box={sliderBox} delay={6} hold={50} pad={12} />
      </Clip>
      <Caption kicker="What if it rains less?" text={`Rainfall 100 % → ${R.rain} %`} duration={80} />
    </Seq>
    <Seq from={800} dur={70}>
      <Clip start={M["adjusted-card"].t - 1.5} duration={70} zoom={[1, 1.2]} origin={[card.x + 500, card.y + 320]}>
      <Highlight box={cardRel(237, 285, 1060, 70)} delay={34} hold={30} />
      </Clip>
      <Caption kicker="Water indicator" text={`${R.baseline} → ${R.adjusted} (${R.delta}) with ${R.rain} % of the rain`} duration={70} />
    </Seq>

    {/* Close */}
    <Seq from={862} dur={38} fade={14}>
      <Background dusk />
      <AbsoluteFill style={{ background: "rgba(6,16,12,.55)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 130px", gap: 26 }}>
        <Headline text="Heirloom." size={150} delay={0} />
        <Sub delay={10} size={46} maxWidth={1500}>See your land from a different perspective.</Sub>
      </AbsoluteFill>
    </Seq>
  </AbsoluteFill>
);

const FadeOut: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  return <div style={{ opacity: interpolate(frame, [from, to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{children}</div>;
};
