/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";

type Month = { month: number; precipMedianMm: number | null; tempMeanC: number | null; yearsUsed: number };
type Props = {
  lang: Lang; t: any; months: Month[]; period: [number, number]; profile: any;
  state: "idle" | "loading" | "error"; onRetry: () => void; onLoad: () => void; coords: string;
};

const BLUE = "#EDE8DB", BLUE_DARK = "#FFFFFF", TERRA = "#E9B877", INK = "#F1EDE2", MUTED = "#A8B5AC", HOLE = "#0E1A15";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ClimateExplorer({ lang, t, months, period, profile, state, onRetry, onLoad, coords }: Props) {
  const loc = lang === "es" ? "es-MX" : "en-US";
  const mName = (i: number) => cap(new Date(2001, i, 1).toLocaleString(loc, { month: "long" }));
  const mShort = (i: number, one: boolean) => (one ? cap(new Date(2001, i, 1).toLocaleString(loc, { month: "narrow" })) : cap(new Date(2001, i, 1).toLocaleString(loc, { month: "short" })).replace(".", ""));
  const mLow = (i: number) => (lang === "es" ? mName(i).toLowerCase() : mName(i)); // Spanish months are lower-case inside a sentence
  const fmtMm = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 0 });
  const fmtC = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const rows = Array.from({ length: 12 }, (_, i) => months[i] ?? { month: i + 1, precipMedianMm: null, tempMeanC: null, yearsUsed: 0 });
  const rain = rows.map((m) => m.precipMedianMm);
  const temp = rows.map((m) => m.tempMeanC);
  const have = rain.some((v) => v != null) && temp.some((v) => v != null);
  const idxMax = (a: (number | null)[]) => a.reduce<number>((b, v, i) => (v != null && (a[b] == null || v > (a[b] as number)) ? i : b), 0);
  const idxMin = (a: (number | null)[]) => a.reduce<number>((b, v, i) => (v != null && (a[b] == null || v < (a[b] as number)) ? i : b), 0);
  const wet = idxMax(rain), dry = idxMin(rain), warm = idxMax(temp);

  const [sel, setSel] = useState(wet);
  const [picked, setPicked] = useState(false);
  const [played, setPlayed] = useState(false);
  const [w, setW] = useState(640);
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { if (!picked) setSel(wet); }, [wet, picked]);

  // measure width so the SVG is drawn in pixels (text stays legible on phones)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el); setW(Math.max(280, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, [have]);

  // bars grow and the line draws once, the first time the chart reaches the viewport
  useEffect(() => {
    const el = wrap.current;
    if (!el || !have || played) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") { setPlayed(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setPlayed(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [have, played]);

  const compact = w < 560;
  const ML = compact ? 40 : 54, MR = 10;
  const ph1 = compact ? 120 : 150, ph2 = compact ? 100 : 120, top1 = 26, gap = 44;
  const top2 = top1 + ph1 + gap, H = top2 + ph2 + 12;
  const colW = (w - ML - MR) / 12;
  const cx = (i: number) => ML + colW * (i + 0.5);

  const maxR = Math.max(...rain.map((v) => v ?? 0), 1);
  const stepR = maxR > 400 ? 200 : maxR > 160 ? 100 : 50;
  const topR = Math.ceil(maxR / stepR) * stepR;
  const tv = temp.filter((v): v is number => v != null);
  const tLo = tv.length ? Math.floor(Math.min(...tv) - 1) : 0, tHi = tv.length ? Math.ceil(Math.max(...tv) + 1) : 1;
  const yR = (v: number) => top1 + ph1 - (v / topR) * ph1;
  const yT = (v: number) => top2 + ph2 - ((v - tLo) / (tHi - tLo)) * ph2;
  const linePts = temp.map((v, i) => (v == null ? null : [cx(i), yT(v)] as [number, number]));
  const lineD = linePts.reduce((d, p) => (p ? `${d}${d ? " L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : d), "");

  const pick = (i: number) => { setPicked(true); setSel(Math.max(0, Math.min(11, i))); };
  const fromEvent = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const scale = r.width / w;
    pick(Math.floor((e.clientX - r.left - ML * scale) / (colW * scale)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    let n = sel;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (sel + 1) % 12;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (sel + 11) % 12;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = 11;
    else return;
    e.preventDefault(); pick(n); btns.current[n]?.focus();
  };

  const m = rows[sel];
  const readout = m.precipMedianMm != null && m.tempMeanC != null
    ? `${mName(sel)} · ${fmtMm(m.precipMedianMm)} mm ${t.ofRain} · ${fmtC(m.tempMeanC)} °C` : mName(sel);
  const observation = !have ? "" : t.obsTpl
    .replace("{wet}", mLow(wet)).replace("{wetMm}", fmtMm(rain[wet] as number))
    .replace("{dry}", mLow(dry)).replace("{dryMm}", fmtMm(rain[dry] as number))
    .replace("{warm}", mLow(warm)).replace("{warmC}", fmtC(temp[warm] as number));

  return (
    <div>
      <p className="eyebrow">{t.stepNo.replace("{n}", "02")} · {t.stepClimate}</p>
      <h2 id="kn" tabIndex={-1} className="text-3xl font-semibold outline-offset-4">{t.known}</h2>
      <p className="num tag mt-1">{coords}</p>

      {state === "loading" && !have && <p className="mt-4" role="status">{t.loading}</p>}
      {state === "error" && <p role="alert" className="risk mt-4">{t.apiDown} <button className="underline" onClick={onRetry}>{t.retry}</button></p>}
      {state === "idle" && !have && <button className="btn mt-4" onClick={onLoad}>{t.seeData}</button>}

      {have && (
        <>
          <p className="mt-4 max-w-3xl text-lg" aria-live="polite">{cap(observation)}</p>
          <p className="tag mt-1"><strong>{t.histBadge.replace("{a}", String(period[0])).replace("{b}", String(period[1]))}</strong> {t.histNote}</p>

          <div className="mt-5 max-w-4xl" ref={wrap}>
            <p className="readout num" role="status" aria-live="polite">{readout}</p>
            <svg ref={svgRef} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${t.precip}; ${t.temp}`}
              style={{ width: "100%", height: "auto", touchAction: "pan-y", display: "block" }}
              onPointerDown={fromEvent} onPointerMove={(e) => { if (e.pointerType === "mouse" || e.buttons) fromEvent(e); }}>
              {/* highlighted month spans both charts */}
              <rect x={ML + colW * sel} y={4} width={colW} height={H - 8} fill={INK} opacity={0.1} />
              {/* rain: horizontal grid + axis */}
              {[0, topR / 2, topR].map((v) => (
                <g key={`r${v}`}><line x1={ML} x2={w - MR} y1={yR(v)} y2={yR(v)} stroke={INK} strokeOpacity={0.12} />
                  <text x={ML - 6} y={yR(v) + 4} textAnchor="end" fontSize={11} fill={MUTED} className="num">{fmtMm(v)}</text></g>
              ))}
              <text x={ML - 6} y={top1 - 12} textAnchor="end" fontSize={11} fill={BLUE_DARK} fontWeight={600}>mm</text>
              {rain.map((v, i) => {
                const h = v == null ? 0 : (v / topR) * ph1, bw = colW * 0.58;
                return (
                  <g key={`b${i}`}>
                    <rect x={cx(i) - bw / 2} y={top1 + ph1 - h} width={bw} height={h} fill={i === sel ? BLUE_DARK : BLUE} opacity={i === sel ? 1 : 0.62}
                      style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: played ? "scaleY(1)" : "scaleY(0)", transition: `transform .8s cubic-bezier(.2,.7,.2,1) ${i * 45}ms` }} />
                    {v != null && (!compact || i === sel) && (
                      <text x={cx(i)} y={top1 + ph1 - h - 5} textAnchor="middle" fontSize={compact ? 11 : 10.5} fill={INK} fontWeight={i === sel ? 700 : 400} className="num"
                        style={{ opacity: played ? 1 : 0, transition: "opacity .4s ease .9s" }}>{fmtMm(v)}</text>
                    )}
                  </g>
                );
              })}
              {/* temperature: line drawn once */}
              {[tLo, (tLo + tHi) / 2, tHi].map((v) => (
                <g key={`t${v}`}><line x1={ML} x2={w - MR} y1={yT(v)} y2={yT(v)} stroke={INK} strokeOpacity={0.12} />
                  <text x={ML - 6} y={yT(v) + 4} textAnchor="end" fontSize={11} fill={MUTED} className="num">{fmtC(v).replace(/[.,]0$/, "")}</text></g>
              ))}
              <text x={ML - 6} y={top2 - 12} textAnchor="end" fontSize={11} fill={TERRA} fontWeight={600}>°C</text>
              <path d={lineD} fill="none" stroke={TERRA} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" pathLength={1}
                strokeDasharray={1} strokeDashoffset={played ? 0 : 1} style={{ transition: "stroke-dashoffset 1.5s ease .2s" }} />
              {linePts.map((p, i) => p && (
                <g key={`d${i}`} style={{ opacity: played ? 1 : 0, transition: `opacity .4s ease ${0.5 + i * 0.09}s` }}>
                  <circle cx={p[0]} cy={p[1]} r={i === sel ? 6 : 3.4} fill={i === sel ? TERRA : HOLE} stroke={TERRA} strokeWidth={2} />
                  {(!compact || i === sel) && temp[i] != null && (
                    <text x={p[0]} y={p[1] - 10} textAnchor="middle" fontSize={compact ? 11 : 10.5} fill={INK} fontWeight={i === sel ? 700 : 400} className="num">{fmtC(temp[i] as number)}</text>
                  )}
                </g>
              ))}
            </svg>

            {/* month selector aligned under the shared time axis (keyboard: arrows, Home, End) */}
            <div role="radiogroup" aria-label={t.monthPick} onKeyDown={onKey}
              style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", paddingLeft: ML, paddingRight: MR }}>
              {rows.map((_, i) => (
                <button key={i} ref={(el) => { btns.current[i] = el; }} type="button" role="radio" aria-checked={i === sel}
                  aria-label={`${mName(i)}: ${rows[i].precipMedianMm != null ? fmtMm(rows[i].precipMedianMm as number) + " mm" : "—"}, ${rows[i].tempMeanC != null ? fmtC(rows[i].tempMeanC as number) + " °C" : "—"}`}
                  tabIndex={i === sel ? 0 : -1} onClick={() => pick(i)} className="month-btn">{mShort(i, compact)}</button>
              ))}
            </div>
            <p className="tag mt-1">{t.chartHint}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <details>
              <summary className="cursor-pointer underline">{t.origin}</summary>
              <div className="tag mt-2">
                {profile?.sources?.slice(0, 1).map((s: any, i: number) => (
                  <ul key={i} className="list-disc pl-5">
                    <li>NASA POWER {s.apiVersion} · {s.sourceType} · UTC · fill {s.fillValue}</li>
                    <li>{Array.isArray(s.effectiveLocation) ? `cell: ${s.effectiveLocation[1]}, ${s.effectiveLocation[0]} (elev ${s.effectiveLocation[2]} m)` : ""}</li>
                    <li>{profile.spatialNote}</li>
                    <li className="num">{t.quality}: {Object.entries(profile.quality ?? {}).slice(0, 3).map(([k, v]: any) => `${k} ${v.valid}/${v.expected}`).join(" · ")}</li>
                  </ul>
                ))}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer underline">{t.tableValues}</summary>
              <div className="overflow-x-auto">
                <table className="num tag mt-2 text-left">
                  <thead><tr><th className="pr-4">{t.monthWord}</th><th className="pr-4">mm</th><th className="pr-4">°C</th><th>{t.yearsUsedWord}</th></tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i}><td className="pr-4">{mName(i)}</td><td className="pr-4">{r.precipMedianMm == null ? "—" : fmtMm(r.precipMedianMm)}</td>
                      <td className="pr-4">{r.tempMeanC == null ? "—" : fmtC(r.tempMeanC)}</td><td>{r.yearsUsed}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
