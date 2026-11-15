import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Cam, Pic, Ring, Seed, ShotBg, Title } from "./components/cinema";
import vo from "../public/vo/vo.json";
import { C, fontFamily } from "./theme";

// 30 s cinematic ad, 120 BPM (15 frames per beat). Every cut lands on a beat; accents are baked into music.wav.
// 0-2 s seed | 2-6.5 s question | 6.5-7.8 s Earth -> Veracruz | 7.8-9.8 s map, NASA POWER, SoilGrids | 9.8-14 s farmer input
// and the "no buyer for dry bean" constraint | 14-25 s rotation comparison + between harvest and planting |
// 25-27 s rainfall scenario | 27-30 s close.

// seconds: 0.15 | 2.15 | 5.1 (question, then a beat of space) | 6.75 (faster) | 14.6, 17.3 (slower) | 21.6 | 27.5 (close)
const VO: [string, number][] = [["00.wav", 5], ["01.wav", 65], ["02.wav", 153], ["03.wav", 203], ["04.wav", 438], ["05.wav", 519], ["06.wav", 648], ["07.wav", 825]];
const voDur = vo as Record<string, number>;
const voOn = (f: number) => VO.some(([n, s]) => f >= s - 4 && f <= s + voDur[n] * 30 + 4);

const Cut: React.FC<{ from: number; dur: number; children: React.ReactNode }> = ({ from, dur, children }) => (
  <Sequence from={from} durationInFrames={dur}>{children}</Sequence>
);

const Question: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ background: C.deep, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 132, fontWeight: 600, letterSpacing: -3, color: C.cream, textAlign: "center", lineHeight: 1.02, transform: `scale(${1.08 - 0.08 * p})`, opacity: Math.min(1, p * 1.5) }}>
        WHAT SHOULD I<br /><span style={{ color: C.gold }}>PLANT NEXT?</span>
      </div>
    </AbsoluteFill>
  );
};

const Globe: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(74, 15 + Math.floor((frame * 60) / 39));
  const z = interpolate(frame, [0, 13], [1.25, 1.12], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#06100C", overflow: "hidden" }}>
      <Img src={staticFile(`globe/${String(i).padStart(4, "0")}.png`)} style={{ width: 1920, height: 1080, transform: `scale(${z})` }} />
      <div style={{ position: "absolute", bottom: 110, width: "100%", textAlign: "center", color: C.cream, opacity: interpolate(frame, [20, 27], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>Jesús Carranza · Veracruz · Mexico</div>
    </AbsoluteFill>
  );
};

/** "WHAT TO PLANT EACH CYCLE" hits on the strongest beat, then lifts into the real app heading. */
const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = spring({ frame, fps, config: { damping: 12, stiffness: 220 } });
  const lift = interpolate(frame, [20, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <ShotBg />
      <AbsoluteFill style={{ opacity: lift }}>
        <Cam w={1920} h={1080} from={[150, 95, 1000, 160]} to={[150, 95, 1640, 200]} dur={45} delay={20}>
          <Pic src="shots2/results-head.png" w={1920} h={1080} />
        </Cam>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - lift, background: `rgba(6,16,12,${0.9 * (1 - lift)})` }}>
        <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: -3, color: C.cream, textAlign: "center", transform: `scale(${1.25 - 0.25 * hit})`, lineHeight: 1.02 }}>
          WHAT TO PLANT<br /><span style={{ color: C.gold }}>EACH CYCLE</span>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 70, width: "100%", display: "flex", justifyContent: "center", opacity: lift }}>
        <div style={{ border: `2px solid ${C.gold}`, color: C.goldSoft, background: "rgba(6,16,12,.85)", borderRadius: 999, padding: "12px 30px", fontSize: 30 }}>
          Comparison run · Jesús Carranza · maize and dry bean both available · base scenario
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Current practice above Alternative 1 (cycles aligned), then cycle-by-cycle and "why" highlights. */
const Compare: React.FC = () => {
  const cols: [number, number][] = [[238, 445], [695, 447], [1154, 446]];
  return (
    <AbsoluteFill>
      <ShotBg />
      <Cam w={1600} h={904} from={[0, 0, 1600, 904]} to={[180, 0, 1420, 904]} dur={165}
        area={{ cx: 960, cy: 590, w: 1800, h: 800 }}
        overlay={(m) => (<>
          {cols.map(([x, w], i) => <Ring key={i} box={m([x, 30, w, 489 + 135])} delay={24 + i * 22} hold={20} label={`Cycle ${i + 1}`} dim />)}
          <Ring box={m([230, 489 + 175, 820, 70])} delay={96} hold={68} label="Why this option appears" labelBelow />
        </>)}>
        <Pic src="shots2/current.png" w={1600} h={449} />
        <Pic src="shots2/alt1.png" y={489} w={1600} h={415} />
      </Cam>
      <Title kicker="Current practice vs. Alternative 1" text="What changes in each cycle, and why" />
    </AbsoluteFill>
  );
};


/**
 * Disclosure labels, always in the same corners.
 * Top right (every shot with AI-generated imagery or animation): "AI-generated visuals" + what it covers.
 * Top left on app shots: "Real app screenshots", so authentic footage stays identifiable.
 * Bottom left on the Earth zoom: the satellite imagery credit, separate from the animation label.
 */
const MARKS: { from: number; to: number; what: string; real?: boolean; credit?: string; light?: boolean }[] = [
  { from: 0, to: 60, what: "Illustration" },
  { from: 60, to: 195, what: "Motion graphics" },
  { from: 195, to: 234, what: "Camera animation", credit: "Satellite imagery © Mapbox © OpenStreetMap © Maxar (real imagery)" },
  { from: 234, to: 420, what: "Overlays, zooms and backgrounds", real: true },
  { from: 420, to: 440, what: "Motion graphics" },
  { from: 440, to: 810, what: "Overlays, zooms and backgrounds", real: true },
  { from: 810, to: 855, what: "Illustration" },
  { from: 855, to: 894, what: "Logo generated with ChatGPT", light: true },
];
const pill: React.CSSProperties = { position: "absolute", top: 26, padding: "8px 16px", borderRadius: 10, background: "rgba(6,16,12,.82)", color: "#F1EDE2", fontSize: 24, fontWeight: 600, lineHeight: 1.15, zIndex: 50 };
const Marks: React.FC = () => {
  const f = useCurrentFrame();
  const m = MARKS.find((x) => f >= x.from && f < x.to);
  if (!m) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...pill, right: 28, border: "2px solid #E9B877", textAlign: "right" }}>
        AI-generated visuals
        <div style={{ fontSize: 18, fontWeight: 500, color: "#F6D9A3", marginTop: 2 }}>{m.what}</div>
      </div>
      {m.real && <div style={{ ...pill, left: 28, border: "2px solid rgba(241,237,226,.7)" }}>Real app screenshots<div style={{ fontSize: 18, fontWeight: 500, color: "#A8B5AC", marginTop: 2 }}>Heirloom prototype</div></div>}
      {m.credit && <div style={{ ...pill, top: "auto", bottom: 26, left: 28, fontSize: 20, fontWeight: 500 }}>{m.credit}</div>}
    </AbsoluteFill>
  );
};

export const HeirloomAd: React.FC = () => (
  <AbsoluteFill style={{ background: C.deep, fontFamily }}>
    <Audio src={staticFile("music.wav")} volume={(f) => (f >= 150 && f < 195 ? 0.28 : voOn(f) ? 0.4 : 0.62)} />
    {VO.map(([n, s]) => (
      <Sequence key={n} from={s} durationInFrames={Math.ceil(voDur[n] * 30) + 2}><Audio src={staticFile(`vo/${n}`)} volume={1} /></Sequence>
    ))}

    {/* 0-2 s  the farmer's decision */}
    <Cut from={0} dur={60}><Seed dur={60} /></Cut>
    {/* 2-6.5 s  the question, with a moment of space after it is spoken */}
    <Cut from={60} dur={135}><Question /></Cut>

    {/* 6.5-7.8 s  Earth -> Jesús Carranza (Mapbox satellite, same style as the app map) */}
    <Cut from={195} dur={39}><Globe /></Cut>
    {/* 7.8-8.4 s  match cut into the app's map */}
    <Cut from={234} dur={18}>
      <ShotBg />
      <Cam w={1920} h={1080} from={[1180, 520, 240, 110]} to={[840, 300, 920, 560]} dur={18} area={{ cx: 960, cy: 540, w: 1920, h: 1080 }}>
        <Pic src="shots2/map.png" w={1920} h={1080} />
      </Cam>
    </Cut>
    {/* 8.4-9.1 s  NASA POWER chart with its source label */}
    <Cut from={252} dur={21}>
      <ShotBg />
      <Cam w={1195} h={650} from={[0, 0, 1195, 650]} to={[40, 60, 1100, 590]} dur={21}
        overlay={(m) => <Ring box={m([0, 490, 677, 156])} delay={4} dim={false} />}>
        <Pic src="shots2/chart.png" w={1195} h={471} />
        <Pic src="shots2/chart-source.png" y={490} w={677} h={156} />
      </Cam>
      <Title kicker="NASA POWER · 2005–2024" text="Climate records" />
    </Cut>
    {/* 9.1-9.8 s  SoilGrids regional estimate */}
    <Cut from={273} dur={21}>
      <ShotBg />
      <Cam w={1520} h={1057} from={[20, 205, 740, 190]} to={[0, 200, 1100, 600]} dur={21}
        overlay={(m) => <Ring box={m([30, 215, 720, 100])} delay={4} hold={20} dim={false} />}>
        <Pic src="shots2/soil-card.png" w={1520} h={1057} />
      </Cam>
      <Title kicker="SoilGrids 2.0 · ISRIC" text="Regional soil estimate" />
    </Cut>

    {/* 9.8-11.3 s  what the farmer brings: crop history */}
    <Cut from={294} dur={45}>
      <ShotBg />
      <Cam w={1520} h={500} from={[0, 0, 1520, 500]} to={[60, 40, 1000, 420]} dur={45}>
        <Pic src="shots2/history.png" w={1520} h={500} />
      </Cam>
      <Title kicker="What the farmer brings" text="Crop history" />
    </Cut>
    {/* 11.3-12.2 s  before: an option with dry bean */}
    <Cut from={339} dur={27}>
      <ShotBg />
      <Cam w={1600} h={415} from={[0, 0, 1600, 415]} dur={27} overlay={(m) => <Ring box={m([230, 20, 1370, 80])} delay={3} label="Before" dim={false} />}>
        <Pic src="shots2/alt1.png" w={1600} h={415} />
      </Cam>
      <Title kicker="Both crops available" text="Dry bean → Maize → Dry bean" />
    </Cut>
    {/* 12.2-12.7 s / 12.7-13.2 s  the constraint is ticked (two real states, same framing) */}
    <Cut from={366} dur={15}>
      <ShotBg />
      <Cam w={1464} h={436} from={[0, 235, 760, 160]} dur={15}><Pic src="shots2/constraint-before.png" w={1464} h={436} /></Cam>
      <Title kicker="One real constraint" text="I have no buyer for: Dry bean" />
    </Cut>
    <Cut from={381} dur={15}>
      <ShotBg />
      <Cam w={1464} h={436} from={[0, 235, 760, 160]} dur={15} overlay={(m) => <Ring box={m([272, 262, 120, 26])} dim={false} />}>
        <Pic src="shots2/constraint-after.png" w={1464} h={436} />
      </Cam>
      <Title kicker="One real constraint" text="I have no buyer for: Dry bean" />
    </Cut>
    {/* 13.2-14 s  after: that option no longer appears, with the app's reason */}
    <Cut from={396} dur={24}>
      <ShotBg />
      <Cam w={1600} h={500} from={[0, 190, 1100, 95]} dur={24} overlay={(m) => <Ring box={m([0, 205, 1010, 64])} delay={2} label="After" dim={false} />}>
        <Pic src="shots2/dropped.png" w={1600} h={500} />
      </Cam>
      <Title kicker="Options that do not appear and why" text="The bean rotation is removed" />
    </Cut>

    {/* 14-15.5 s  THE reveal (strongest accent at 14.0 s) */}
    <Cut from={420} dur={45}><Reveal /></Cut>
    {/* 15.5-21 s  current practice vs. alternative 1 */}
    <Cut from={465} dur={165}><Compare /></Cut>
    {/* 21-25 s  between harvest and planting: one actual interval */}
    <Cut from={630} dur={120}>
      <ShotBg />
      <Cam w={1600} h={753} from={[0, 0, 1600, 753]} to={[0, 360, 1600, 190]} dur={120} delay={20}
        overlay={(m) => (<>
          <Ring box={m([945, 410, 440, 52])} delay={40} label="240 days between harvest and planting" />
          <Ring box={m([0, 500, 880, 30])} delay={66} dim={false} labelBelow />
        </>)}>
        <Pic src="shots/08b-between.png" w={1600} h={753} />
      </Cam>
      <Title kicker="Alternative 1 · Maize harvest Oct 18 → next planting Jun 15" text="Between harvest and planting" />
    </Cut>

    {/* 25-27 s  optional next step: less rain (the app's actual result) */}
    <Cut from={750} dur={60}>
      <ShotBg />
      <Cam w={1600} h={419} from={[200, 255, 1150, 110]} to={[220, 270, 1080, 95]} dur={60}
        overlay={(m) => <Ring box={m([235, 288, 520, 34])} delay={8} dim={false} />}>
        <Pic src="shots/07b-card-scenario.png" w={1600} h={419} />
      </Cam>
      <Title kicker="Optional next step" text="Test 80 % of the rainfall" />
    </Cut>

    {/* 27-30 s  close on the decision */}
    <Cut from={810} dur={45}><Seed dur={45} planted videoStart={60} /></Cut>
    <Cut from={855} dur={39}><EndCard /></Cut>
    <Marks />
  </AbsoluteFill>
);

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 } });
  const q = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: "#F6F2EA", justifyContent: "center", alignItems: "center" }}>
      <Img src={staticFile("logo-heirloom.webp")} style={{ width: 760, opacity: p, transform: `scale(${0.96 + 0.04 * p})`, marginTop: -90 }} />
      <div style={{ color: "#263329", fontSize: 50, fontWeight: 600, letterSpacing: -1, opacity: q, transform: `translateY(${(1 - q) * 14}px)`, marginTop: -10 }}>Compare your options before you plant.</div>
      <div style={{ position: "absolute", bottom: 46, color: "#626B5D", fontSize: 24, letterSpacing: 4, textTransform: "uppercase", opacity: q }}>NASA Space Apps 2026 · Field Shift</div>
    </AbsoluteFill>
  );
};
