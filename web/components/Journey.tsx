/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { T, type Lang } from "@/lib/i18n";
import MapPicker from "./MapPicker";
import { tr as trEng } from "@/lib/engineText";
import { reasonText } from "@/lib/screeningText";

const API = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:8000";
type Place = { name: string; full: string; lat: number; lon: number };
type Month = { month: number; precipMedianMm: number | null; tempMeanC: number | null; yearsUsed: number };
type Cycle = { crop: string; also: string; approx: string };
type MD = { m: string; d: string };

async function post(path: string, body: unknown, signal?: AbortSignal) {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function Bars({ values, label, unit, fmt = 0 }: { values: (number | null)[]; label: string; unit: string; fmt?: number }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const months = "JFMAMJJASOND";
  return (
    <figure className="m-0">
      <figcaption className="tag mb-1">{label}</figcaption>
      <svg viewBox="0 0 360 120" role="img" aria-label={label} className="w-full">
        {values.map((v, i) => {
          const h = v == null ? 0 : (Math.max(v, 0) / max) * 90;
          return (
            <g key={i}>
              <rect x={i * 30 + 4} y={100 - h} width={22} height={h} fill="#3E5B4F" />
              <text x={i * 30 + 15} y={114} fontSize="10" textAnchor="middle" fill="#3E5B4F">{months[i]}</text>
              {v != null && <text x={i * 30 + 15} y={95 - h} fontSize="9" textAnchor="middle" className="num" fill="#172D27">{v.toFixed(fmt)}</text>}
            </g>
          );
        })}
      </svg>
      <details className="tag"><summary>Tabla / Table ({unit})</summary>
        <table className="num"><tbody>{values.map((v, i) => <tr key={i}><td>{i + 1}</td><td>{v == null ? "—" : v.toFixed(1)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

const num = (s: string) => (s.trim() === "" || !isFinite(Number(s)) ? undefined : Number(s));

function MDInput({ v, set, label }: { v: MD; set: (x: MD) => void; label: string }) {
  return (
    <label className="flex flex-col text-sm">{label}
      <span className="flex gap-2">
        <input className="w-20" type="number" min={1} max={12} value={v.m} onChange={(e) => set({ ...v, m: e.target.value })} aria-label="month" />
        <input className="w-20" type="number" min={1} max={31} value={v.d} onChange={(e) => set({ ...v, d: e.target.value })} aria-label="day" />
      </span>
    </label>
  );
}

export default function Journey({ lang }: { lang: Lang }) {
  const t = T[lang];
  const other: Lang = lang === "es" ? "en" : "es";
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [coords, setCoords] = useState({ lat: "", lon: "", elev: "" });
  const [confirmed, setConfirmed] = useState<{ lat: number; lon: number; elevation?: number } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileState, setProfileState] = useState<"idle" | "loading" | "error">("idle");

  // farmer answers
  const [cycles, setCycles] = useState<Cycle[]>([{ crop: "maize", also: "", approx: "" }, { crop: "bean", also: "", approx: "" }, { crop: "maize", also: "", approx: "" }]);
  const [usual, setUsual] = useState<MD>({ m: "6", d: "15" });
  const [winFrom, setWinFrom] = useState<MD>({ m: "", d: "" });
  const [winTo, setWinTo] = useState<MD>({ m: "", d: "" });
  const [regime, setRegime] = useState<"rainfed" | "irrigated" | "both" | "unknown">("unknown");
  const [irrFrom, setIrrFrom] = useState<MD>({ m: "", d: "" });
  const [irrTo, setIrrTo] = useState<MD>({ m: "", d: "" });
  const [irrDepth, setIrrDepth] = useState("");
  const [irrEvery, setIrrEvery] = useState("");
  const [allowed, setAllowed] = useState<string[]>(["maize", "bean"]);
  const [cons, setCons] = useState({ seed: "", equipment: "", buyer: "" });
  const [mgmt, setMgmt] = useState({ residues: "unknown", cover: "unknown", waterlog: "unknown", runoff: "unknown", priority: "" });
  const [opt, setOpt] = useState({ area: "", costs: "" });
  const [soil, setSoil] = useState({ fc: "", wp: "" });
  const [soilSource, setSoilSource] = useState<"" | "regional" | "farmer" | "demo">("");
  const [soilProf, setSoilProf] = useState<any>(null);
  const [soilProfState, setSoilProfState] = useState<"idle" | "loading" | "error">("idle");
  const [blocked, setBlocked] = useState<{ seed: string[]; equip: string[]; buyer: string[] }>({ seed: [], equip: [], buyer: [] });

  const [run, setRun] = useState<any>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">("idle");
  const [runErr, setRunErr] = useState("");
  const [simOn, setSimOn] = useState(false);
  const [shift, setShift] = useState(0);
  const [rain, setRain] = useState(100);
  const [simRun, setSimRun] = useState<any>(null);
  const [simBusy, setSimBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosenRef = useRef<string | null>(null);
  const knownRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(-1);
  const [placeName, setPlaceName] = useState("");
  const [flyToken, setFlyToken] = useState(0);
  const [knownSeen, setKnownSeen] = useState(false);

  const motionOff = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: motionOff() ? "auto" : "smooth", block: "start" });

  async function searchNow(query: string, signal?: AbortSignal): Promise<Place[] | null> {
    if (query.trim().length < 3) { setPlaces(null); setSearchMsg(query.trim().length ? t.minChars : ""); return null; }
    setSearchMsg(t.searching);
    try {
      const r = await fetch(`${API}/api/places?q=${encodeURIComponent(query.trim())}&language=${lang}`, { signal });
      if (r.status === 503) { setSearchMsg(t.noToken); setPlaces(null); return null; }
      if (!r.ok) throw new Error();
      const j = await r.json(); setPlaces(j.results); setActive(-1);
      setSearchMsg(j.results.length ? "" : t.noResultsHelp);
      return j.results as Place[];
    } catch (e: any) {
      if (e.name !== "AbortError") { setPlaces(null); setSearchMsg(t.searchErrorHelp); }
      return null;
    }
  }

  // Search-as-you-type: debounced 350 ms, min 3 chars, stale requests cancelled
  useEffect(() => {
    if (chosenRef.current === q) return;  // the text was filled by a confirmed locality
    if (q.length < 3) { setPlaces(null); setSearchMsg(""); return; }
    const ac = new AbortController();
    const id = setTimeout(() => searchNow(q, ac.signal), 350);
    return () => { clearTimeout(id); ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lang]);

  // Enter / "Search": confirm the highlighted suggestion; a single match is confirmed; several show the options
  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (places && active >= 0 && places[active]) { choose(places[active]); return; }
    const res = await searchNow(q);
    if (res && res.length === 1) { choose(res[0]); return; }
    if (res && res.length > 1) { setSearchMsg(t.pickOne); return; }
    inputRef.current?.focus();  // nothing usable: keep the focus on the search field
  }

  function choose(p: Place) {
    const name = p.full || p.name;
    chosenRef.current = name; setQ(name); setPlaces(null); setActive(-1); setSearchMsg("");
    setCoords({ lat: String(p.lat), lon: String(p.lon), elev: "" }); setPlaceName(name);
    setFlyToken((n) => n + 1);
    confirmLocation(p.lat, p.lon, undefined, "map");
  }

  function invalidate() { setSoilProf(null); setSoilSource(""); setProfile(null); setRun(null); setSimRun(null); setSimOn(false); setShift(0); setRain(100); }

  function confirmLocation(lat: number, lon: number, elevation?: number, target: "map" | "known" = "known") {
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const loc = { lat, lon, elevation };
    invalidate(); setConfirmed(loc);
    setTimeout(() => scrollToId(target === "map" ? "map-section" : "known"), 60);
    loadProfile(loc);  // pre-query the climate while the person looks at the map
  }

  async function loadProfile(loc?: { lat: number; lon: number; elevation?: number }) {
    const L = loc ?? confirmed;
    if (!L) return;
    setProfileState("loading");
    try { setProfile(await post("/api/location-profile", { location: L })); setProfileState("idle"); } catch { setProfileState("error"); }
  }

  function goClimate(e: React.MouseEvent) {
    e.preventDefault();
    scrollToId("known");
    setTimeout(() => document.getElementById("kn")?.focus({ preventScroll: true }), motionOff() ? 0 : 450);
  }

  // The climate section fades/slides in the first time it reaches the viewport
  useEffect(() => {
    if (!confirmed || knownSeen) return;
    const el = knownRef.current;
    if (!el) return;
    if (motionOff() || typeof IntersectionObserver === "undefined") { setKnownSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { setKnownSeen(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
     
  }, [confirmed, knownSeen]);

  async function loadSoil() {
    if (!confirmed) return;
    setSoilProfState("loading");
    try {
      const j = await post("/api/soil-profile", { location: confirmed });
      setSoilProf(j); setSoilProfState(j.status === "ok" ? "idle" : "error");
      if (j.status === "ok" && j.hydraulics?.usable) setSoilSource("regional");
    } catch { setSoilProfState("error"); }
  }
  const toggleIn = (k: "seed" | "equip" | "buyer", c: string) =>
    setBlocked((b) => ({ ...b, [k]: b[k].includes(c) ? b[k].filter((x) => x !== c) : [...b[k], c] }));

  const tri = (v: string) => (v === "yes" ? true : v === "no" ? false : undefined);
  const hasMD = (x: MD) => num(x.m) != null && num(x.d) != null;

  const body = () => ({
    location: confirmed,
    history: cycles.map((c) => ({ crops: [c.crop, ...(c.also ? [c.also] : [])], approxDate: c.approx || undefined })),
    plantMonth: num(usual.m) ?? 6, plantDay: num(usual.d) ?? 15,
    window: hasMD(winFrom) && hasMD(winTo) ? { startMonth: num(winFrom.m), startDay: num(winFrom.d), endMonth: num(winTo.m), endDay: num(winTo.d) } : undefined,
    waterRegime: regime,
    irrigation: regime === "irrigated" || regime === "both"
      ? { startMonth: num(irrFrom.m), startDay: num(irrFrom.d) ?? 1, endMonth: num(irrTo.m), endDay: num(irrTo.d) ?? 28, applicationMm: num(irrDepth), intervalDays: num(irrEvery) }
      : undefined,
    allowedCrops: allowed, constraintNotes: cons,
    constraints: { seedUnavailable: blocked.seed, equipmentUnsupported: blocked.equip, noBuyer: blocked.buyer },
    management: {
      residues: mgmt.residues, coverCrop: tri(mgmt.cover), waterlogging: tri(mgmt.waterlog), runoff: tri(mgmt.runoff),
      priority: mgmt.priority || undefined, areaHa: num(opt.area), ownCostsMxnPerHa: num(opt.costs),
    },
    soil: (soilSource === "farmer" || soilSource === "demo") && num(soil.fc) != null && num(soil.wp) != null ? { thetaFC: num(soil.fc), thetaWP: num(soil.wp) } : undefined,
    soilIsDemo: soilSource === "demo",
    soilSource: soilSource || undefined,
  });

  async function compare() {
    setRunState("loading"); setRunErr(""); setSimRun(null); setSimOn(false); setShift(0); setRain(100);
    try { setRun(await post("/api/rotation-comparison", body())); setRunState("idle"); }
    catch (e: any) { setRunState("error"); setRunErr(e.message === "422" ? "422" : ""); }
  }

  // Simulator: recompute with scenario, cancel obsolete requests
  useEffect(() => {
    if (!simOn || !run) return;
    if (shift === 0 && rain === 100) { setSimRun(null); return; }
    const id = setTimeout(async () => {
      abort.current?.abort(); const ac = new AbortController(); abort.current = ac; setSimBusy(true);
      try { setSimRun(await post("/api/scenarios", { ...body(), plantShiftDays: shift, precipScale: rain / 100 }, ac.signal)); setSimBusy(false); }
      catch (e: any) { if (e.name !== "AbortError") setSimBusy(false); }
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift, rain, simOn]);

  const months: Month[] = profile?.monthly?.months ?? [];
  const cropLabel = (c: string) => (c === "maize" ? t.maize : c === "bean" ? t.bean : c);
  const label = (r: any, i: number) => (r.id === "current" ? t.current : `${t.altN} ${i}`);
  const E = (x: string) => trEng(lang, x);
  const kind = (k: string) => (k === "data" ? t.kindData : k === "model" ? t.kindModel : t.kindSource);
  const indName: Record<string, string> = { A: t.waterName, H: t.heat, S: t.soilC, E: t.erosion, U: t.margin };
  const signed = (d: number) => { const s = d.toFixed(1); return s === "0.0" || s === "-0.0" ? "±0.0" : d > 0 ? `+${s}` : `−${Math.abs(d).toFixed(1)}`; };
  const hasIntercrop = cycles.some((c) => c.also);
  const reg = run?.soil?.sources?.regional;
  const soilLine = !run ? "" : run.soil?.active === "regional"
    ? (reg?.qualityFlags?.includes("nearest_valid_cell") ? t.soilLineRegional.replace("{m}", String(Math.round(reg.distanceM))) : t.soilLineRegionalExact)
    : run.soil?.active === "farmer" ? t.soilLineFarmer : run.soil?.active === "demo" ? t.soilLineDemo : "";
  const toggleCrop = (c: string) => setAllowed((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));
  const winBad = hasMD(winFrom) !== hasMD(winTo);

  return (
    <main>
      <header className="absolute z-10 flex w-full items-center justify-between px-6 py-4 text-sm text-cream">
        <span className="font-semibold tracking-wide">heirloom</span>
        <Link href={`/${other}`} className="underline" hrefLang={other}>{other.toUpperCase()}</Link>
      </header>

      <section className="hero flex items-end px-6 pb-12 pt-24 md:px-[8vw] md:pb-16">
        <div className="w-full max-w-[1280px]">
         <div className="hero-copy max-w-[640px]">
          <h1>{t.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-lg">{t.heroSub}</p>
          <form role="search" className="relative mt-7 max-w-xl text-ink" onSubmit={onSearchSubmit}>
            <label htmlFor="q" className="mb-1 block text-sm text-cream">{t.search}</label>
            <div className="flex gap-2">
              <input id="q" ref={inputRef} className="min-w-0 flex-1" value={q} onChange={(e) => { chosenRef.current = null; setQ(e.target.value); }} autoComplete="off"
                placeholder={t.searchEx} role="combobox" aria-expanded={!!places?.length} aria-controls="places" aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `place-${active}` : undefined}
                onKeyDown={(e) => {
                  if (!places?.length) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % places.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? places.length - 1 : i - 1)); }
                  else if (e.key === "Escape") { setPlaces(null); setActive(-1); }
                }} />
              <button type="submit" className="btn accent hero-search">{t.searchBtn}</button>
            </div>
            <div aria-live="polite" className="mt-1 min-h-5 text-sm text-cream">{searchMsg}</div>
            {places && places.length > 0 && (
              <ul id="places" role="listbox" className="panel absolute left-0 right-0 z-20 mt-1 max-h-64 list-none overflow-auto p-0 shadow-md">
                {places.map((p, i) => (
                  <li key={i} id={`place-${i}`} role="option" aria-selected={i === active} className="opt flex min-h-[44px] cursor-pointer items-center px-3"
                    onMouseEnter={() => setActive(i)} onClick={() => choose(p)}>{p.full || p.name}</li>
                ))}
              </ul>
            )}
          </form>
         </div>
        </div>
        <span className="hero-caption">{t.illusShort}</span>
      </section>

      <div className="mx-auto max-w-[1280px] px-6 py-16 md:px-10">
        <section id="map-section" aria-labelledby="loc" className="panel scroll-mt-4 p-6">
          <h2 id="loc" className="text-2xl font-semibold">{t.placeMap}</h2>
          {placeName && <p className="mt-1 font-semibold" aria-live="polite">{t.placeConfirmed}: {placeName}</p>}
          <div className="mt-2"><MapPicker lat={isFinite(parseFloat(coords.lat)) ? parseFloat(coords.lat) : null} lon={isFinite(parseFloat(coords.lon)) ? parseFloat(coords.lon) : null}
            onChange={(la, lo) => setCoords((c) => ({ ...c, lat: la.toFixed(5), lon: lo.toFixed(5) }))} unavailableText={t.mapUnavailable} failedText={t.mapFailed} flyToken={flyToken} /></div>
          {confirmed && <p className="mt-3"><a href="#known" className="font-medium underline" onClick={goClimate}>{t.seeClimate} ↓</a></p>}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["lat", "lon", "elev"] as const).map((k) => (
              <label key={k} className="flex flex-col text-sm">{t[k]}
                <input inputMode="decimal" value={coords[k]} onChange={(e) => setCoords({ ...coords, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <p className="tag mt-2">{t.pointNote}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn" onClick={() => confirmLocation(Number(coords.lat), Number(coords.lon), coords.elev ? Number(coords.elev) : undefined)}>{t.useLoc}</button>
            <button className="btn ghost" onClick={() => { setCoords({ lat: "17.432993", lon: "-95.02336", elev: "" }); setCycles([{ crop: "maize", also: "", approx: "" }, { crop: "bean", also: "", approx: "" }, { crop: "maize", also: "", approx: "" }]); setUsual({ m: "6", d: "15" }); }}>{t.pilot}</button>
          </div>
          <p className="tag mt-1">{t.pilotNote}</p>
        </section>

        {confirmed && (
          <section id="known" ref={knownRef} aria-labelledby="kn" className={`panel reveal mt-10 scroll-mt-4 p-6${knownSeen ? " in" : ""}`}>
            <h2 id="kn" tabIndex={-1} className="text-2xl font-semibold outline-offset-4">{t.known}</h2>
            <p className="num tag">{confirmed.lat.toFixed(4)}, {confirmed.lon.toFixed(4)}</p>
            {!profile && <button className="btn mt-3" onClick={() => loadProfile()} disabled={profileState === "loading"}>{profileState === "loading" ? t.loading : t.seeData}</button>}
            {profileState === "error" && <p role="alert" className="risk mt-2">{t.apiDown} <button className="underline" onClick={() => loadProfile()}>{t.retry}</button></p>}
            {profile && (
              <>
                <p className="tag mt-2">{t.histNote} ({profile.period[0]}–{profile.period[1]})</p>
                <div className="mt-4 grid gap-8 md:grid-cols-2">
                  <Bars values={months.map((m) => m.precipMedianMm)} label={t.precip} unit="mm" />
                  <Bars values={months.map((m) => m.tempMeanC)} label={t.temp} unit="°C" fmt={1} />
                </div>
                <details className="mt-4">
                  <summary>{t.origin}</summary>
                  <div className="tag mt-2">
                    {profile.sources.slice(0, 1).map((s: any, i: number) => (
                      <ul key={i} className="list-disc pl-5">
                        <li>NASA POWER {s.apiVersion} · {s.sourceType} · UTC · fill {s.fillValue}</li>
                        <li>{Array.isArray(s.effectiveLocation) ? `cell: ${s.effectiveLocation[1]}, ${s.effectiveLocation[0]} (elev ${s.effectiveLocation[2]} m)` : ""}</li>
                        <li>{profile.spatialNote}</li>
                        <li className="num">{t.quality}: {Object.entries(profile.quality).slice(0, 3).map(([k, v]: any) => `${k} ${v.valid}/${v.expected}`).join(" · ")}</li>
                      </ul>
                    ))}
                  </div>
                </details>
              </>
            )}
          </section>
        )}

        {profile && (
          <section aria-labelledby="ask" className="panel mt-10 p-6">
            <h2 id="ask" className="text-2xl font-semibold">{t.tell}</h2>

            <fieldset className="mt-6"><legend className="text-lg font-semibold">{t.q1}</legend>
              <p className="tag">{t.q1h}</p>
              {cycles.map((c, i) => (
                <div key={i} className="mt-3 flex flex-wrap items-end gap-3">
                  <span className="tag w-16">{t.cycle} {i + 1}</span>
                  <label className="flex flex-col text-sm">{t.crop}
                    <select value={c.crop} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, crop: e.target.value } : x)))}>
                      <option value="maize">{t.maize}</option><option value="bean">{t.bean}</option>
                    </select></label>
                  <label className="flex flex-col text-sm">{t.alsoWith}
                    <select value={c.also} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, also: e.target.value } : x)))}>
                      <option value="">{t.none}</option><option value="maize">{t.maize}</option><option value="bean">{t.bean}</option>
                    </select></label>
                  <label className="flex flex-col text-sm">{t.approx}
                    <input value={c.approx} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, approx: e.target.value } : x)))} /></label>
                  {cycles.length > 1 && <button className="btn ghost" onClick={() => setCycles(cycles.filter((_, j) => j !== i))}>{t.removeCycle}</button>}
                </div>
              ))}
              {cycles.length < 5 && <button className="btn ghost mt-3" onClick={() => setCycles([...cycles, { crop: "maize", also: "", approx: "" }])}>{t.addCycle}</button>}
              {hasIntercrop && <p role="status" className="risk mt-2 text-sm">{t.intercropWarn}</p>}
            </fieldset>

            <fieldset className="mt-8"><legend className="text-lg font-semibold">{t.q2}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                <MDInput v={usual} set={setUsual} label={t.usual} />
                <MDInput v={winFrom} set={setWinFrom} label={t.winFrom} />
                <MDInput v={winTo} set={setWinTo} label={t.winTo} />
              </div>
              <p className="tag mt-1">{t.winOpt}</p>
              {winBad && <p role="alert" className="risk text-sm">{t.winFrom} / {t.winTo}</p>}
            </fieldset>

            <fieldset className="mt-8"><legend className="text-lg font-semibold">{t.q3}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {([["rainfed", t.rainfed], ["irrigated", t.irrigated], ["both", t.both], ["unknown", t.unknownOpt]] as const).map(([v, l]) => (
                  <label key={v} className="flex min-h-[44px] items-center gap-2"><input type="radio" name="regime" checked={regime === v} onChange={() => setRegime(v)} className="!min-h-0" />{l}</label>
                ))}
              </div>
              {(regime === "irrigated" || regime === "both") && (
                <>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <MDInput v={irrFrom} set={setIrrFrom} label={t.irrFrom} />
                    <MDInput v={irrTo} set={setIrrTo} label={t.irrTo} />
                    <label className="flex flex-col text-sm">{t.irrDepth}<input inputMode="decimal" className="w-28" value={irrDepth} onChange={(e) => setIrrDepth(e.target.value)} placeholder={t.unknown} /></label>
                    <label className="flex flex-col text-sm">{t.irrEvery}<input inputMode="numeric" className="w-28" value={irrEvery} onChange={(e) => setIrrEvery(e.target.value)} placeholder={t.unknown} /></label>
                  </div>
                  <p className="tag mt-1">{t.irrNeed}</p>
                </>
              )}
            </fieldset>

            <fieldset className="mt-8"><legend className="text-lg font-semibold">{t.q4}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {(["maize", "bean"] as const).map((c) => (
                  <label key={c} className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={allowed.includes(c)} onChange={() => toggleCrop(c)} className="!min-h-0" />{cropLabel(c)}</label>
                ))}
              </div>
              <div className="mt-3 space-y-1">
                {([["seed", t.seedNo], ["equip", t.equipNo], ["buyer", t.buyerNo]] as const).map(([k, l]) => (
                  <div key={k} className="flex flex-wrap items-center gap-4"><span className="text-sm">{l}</span>
                    {(["maize", "bean"] as const).map((c) => (
                      <label key={c} className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={blocked[k].includes(c)} onChange={() => toggleIn(k, c)} className="!min-h-0" />{cropLabel(c)}</label>
                    ))}
                  </div>
                ))}
                <p className="tag">{t.constraintsNote}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {(["seed", "equipment", "buyer"] as const).map((k) => (
                  <label key={k} className="flex flex-col text-sm">{t[k]}<input value={cons[k]} onChange={(e) => setCons({ ...cons, [k]: e.target.value })} /></label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-8"><legend className="text-lg font-semibold">{t.q5}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex flex-col text-sm">{t.residues}
                  <select value={mgmt.residues} onChange={(e) => setMgmt({ ...mgmt, residues: e.target.value })}>
                    <option value="unknown">{t.unknown}</option><option value="retain">{t.resRetain}</option><option value="partial">{t.resPartial}</option><option value="remove">{t.resRemove}</option>
                  </select></label>
                {([["cover", t.cover], ["waterlog", t.waterlog], ["runoff", t.runoffQ]] as const).map(([k, l]) => (
                  <label key={k} className="flex flex-col text-sm">{l}
                    <select value={(mgmt as any)[k]} onChange={(e) => setMgmt({ ...mgmt, [k]: e.target.value })}>
                      <option value="unknown">{t.unknown}</option><option value="yes">{t.yes}</option><option value="no">{t.no}</option>
                    </select></label>
                ))}
                <label className="flex flex-col text-sm">{t.priority}
                  <select value={mgmt.priority} onChange={(e) => setMgmt({ ...mgmt, priority: e.target.value })}>
                    <option value="">{t.unknown}</option><option value="water">{t.pWater}</option><option value="soil">{t.pSoil}</option><option value="margin">{t.pMargin}</option>
                  </select></label>
              </div>
              <p className="tag mt-1">{t.prioNote}</p>
              <details className="mt-3"><summary>{t.optional}: {t.area}, {t.costs}</summary>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex flex-col text-sm">{t.area}<input inputMode="decimal" value={opt.area} onChange={(e) => setOpt({ ...opt, area: e.target.value })} /></label>
                  <label className="flex flex-col text-sm">{t.costs}<input inputMode="decimal" value={opt.costs} onChange={(e) => setOpt({ ...opt, costs: e.target.value })} /></label>
                </div>
              </details>
            </fieldset>

            <details className="mt-8 border-t border-line pt-4" open>
              <summary className="cursor-pointer text-lg font-semibold">{t.soilTech}</summary>
              <p className="tag mt-2">{t.soilHelp}</p>
              <p className="mt-3 font-semibold">{t.soilSourceTitle}</p>
              <div className="mt-1 flex flex-col gap-1">
                {([["regional", t.srcRegional], ["farmer", t.srcFarmer], ["demo", t.srcDemo]] as const).map(([v, l]) => (
                  <label key={v} className="flex min-h-[44px] items-center gap-2">
                    <input type="radio" name="soilsrc" className="!min-h-0" checked={soilSource === v}
                      disabled={v === "regional" && !(soilProf?.status === "ok" && soilProf?.hydraulics?.usable)}
                      onChange={() => { setSoilSource(v); if (v === "demo") setSoil({ fc: "0.30", wp: "0.15" }); }} />{l}
                  </label>
                ))}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <button className="btn ghost" onClick={loadSoil} disabled={soilProfState === "loading"}>{soilProfState === "loading" ? t.regionalLoading : soilProfState === "error" ? t.regionalRetry : t.regionalBtn}</button>
                {soilProfState === "error" && <p role="alert" className="risk mt-2 text-sm">{t.regionalErr} {soilProf?.qualityFlags?.includes("api_timeout") ? t.regionalTimeout : soilProf?.reason ? E(soilProf.reason) : ""}</p>}
                {!(soilProf?.status === "ok" && soilProf?.hydraulics?.usable) && soilProfState !== "error" && <p className="tag mt-1">{t.regionalFirst}</p>}
                {soilProf?.status === "ok" && (
                  <div className="mt-2">
                    <p className="tag">{t.regionalNote} SoilGrids 2.0 · {soilProf.manifest?.license}</p>
                    {soilProf.qualityFlags?.includes("nearest_valid_cell") && <p className="risk text-sm" role="note">{t.nearestCell.replace("{m}", String(Math.round(soilProf.distanceM)))}</p>}
                    <div className="overflow-x-auto">
                      <table className="num tag mt-1 w-full min-w-[560px] text-left">
                        <thead><tr><th>{t.depth}</th><th>{t.clay} ({t.range90})</th><th>{t.sand}</th><th>{t.soc}</th><th>{t.fcShort}</th><th>{t.wpShort}</th></tr></thead>
                        <tbody>
                          {soilProf.layers.map((L: any, i: number) => {
                            const H = soilProf.hydraulics?.layers?.[i];
                            return (<tr key={L.label}><td>{L.label}</td>
                              <td>{L.clay_pct?.toFixed(1)} ({L.clay_pct_q05?.toFixed(0)}–{L.clay_pct_q95?.toFixed(0)})</td>
                              <td>{L.sand_pct?.toFixed(1)}</td><td>{L.soc_g_kg?.toFixed(1)}</td>
                              <td>{H ? H.fc.toFixed(3) : "—"}</td><td>{H ? H.wp.toFixed(3) : "—"}</td></tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="tag mt-1">{t.ptfNote}</p>
                    {!soilProf.hydraulics?.usable && <p className="risk text-sm">{t.regionalBlocked}: {soilProf.hydraulics?.issues?.join("; ")}</p>}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3">
                <label className="flex flex-col text-sm">{t.fc}<input inputMode="decimal" value={soil.fc} disabled={soilSource === "regional"} onChange={(e) => { setSoil({ ...soil, fc: e.target.value }); setSoilSource("farmer"); }} placeholder={t.unknown} /></label>
                <label className="flex flex-col text-sm">{t.wp}<input inputMode="decimal" value={soil.wp} disabled={soilSource === "regional"} onChange={(e) => { setSoil({ ...soil, wp: e.target.value }); setSoilSource("farmer"); }} placeholder={t.unknown} /></label>
                <button className="btn ghost self-end" disabled={soilSource === "regional"} onClick={() => { setSoil({ fc: "", wp: "" }); setSoilSource(""); }}>{t.unknown}</button>
              </div>
              {soilSource === "regional" && <p className="tag mt-1" role="note">{t.soilFieldsLocked}</p>}
              {soilSource === "demo" && <p className="tag mt-2" role="note">{t.demoTag}</p>}
              {!soilSource && <p className="risk mt-2 text-sm">{t.soilNeed}</p>}
            </details>

            <button className="btn mt-6" onClick={compare} disabled={runState === "loading" || winBad}>{runState === "loading" ? t.computing : t.compute}</button>
            {runState === "error" && <p role="alert" className="risk mt-2">{runErr === "422" ? `${t.winFrom} / ${t.usual}` : t.apiDown}</p>}
          </section>
        )}

        {run && (
          <section aria-labelledby="cmp" className="mt-10">
            <h2 id="cmp" className="text-3xl font-semibold">{t.three}</h2>
            <p className="tag">{t.mode}</p>
            {run.warnings?.length > 0 && <ul className="risk mt-2 list-disc pl-5 text-sm" role="status">{run.warnings.map((w: string) => <li key={w}>{E(w)}</li>)}</ul>}
            {simRun?.calendar?.scenarioOutsideWindow && <p role="alert" className="risk mt-2 text-sm">{t.outsideWindow}</p>}

            <div className="mt-4 space-y-4">
              {run.rotations.map((r: any, i: number) => {
                const base = r.indicators.A; const sc = simRun?.rotations?.[i]?.indicators?.A;
                const adjusted = !!(simOn && simRun && sc?.summary && base.summary);
                const S = adjusted ? sc.summary : base.summary;
                const d = adjusted ? sc.summary.medianA - base.summary.medianA : 0; // unrounded medians, as specified
                const A = adjusted ? sc : base;
                return (
                  <article key={r.id} className="panel p-5">
                    <h3 className="text-xl font-semibold">{label(r, i)}{r.structure && <span className="ml-2 border border-ink px-2 py-0.5 align-middle text-sm font-normal">{r.structure === "monoculture" ? t.monoculture : r.structure === "intercrop" ? t.structIntercrop : t.structRotation}</span>}</h3>
                    {r.sequence ? (
                      <div className="mt-2 flex gap-1" role="img" aria-label={r.sequence.map(cropLabel).join(" → ")}>
                        {r.sequence.map((c: string, j: number) => (
                          <div key={j} className="flex-1 border border-line bg-[#EDE6D3] px-2 py-1 text-sm">{`${j + 1} · ${cropLabel(c)}`}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-1" aria-label={t.hist}>
                        {r.history.map((h: any, j: number) => (
                          <div key={j} className="flex-1 border border-line bg-[#EDE6D3] px-2 py-1 text-sm">{`${j + 1} · ${h.crops.map(cropLabel).join(" + ")}`}</div>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 num" aria-live="polite">
                      <strong>{indName.A}:</strong>{" "}
                      {S ? <>{t.median} {S.medianA.toFixed(1)}/100{adjusted && <span> ({signed(d)} {t.vsBase})</span>}
                        <span className="tag"> · P10–P90 {S.p10.toFixed(1)}–{S.p90.toFixed(1)} · {S.validBlocks}/{S.totalBlocks} {t.valid}{adjusted ? ` · ${t.scenarioPct}` : ""}</span></>
                        : <span>{t.pending}</span>}
                    </p>
                    {S && soilLine && <p className="tag">{soilLine}</p>}
                    {adjusted && d === 0 && S.medianA >= 99.95 && <p className="tag">{t.ceiling}</p>}
                    {A.status === "conditional" && <p className="risk text-sm">{t.conditional}</p>}
                    {A.conditions?.length > 0 && <ul className="tag list-disc pl-5">{A.conditions.map((c: string) => <li key={c}>{E(c)}</li>)}</ul>}
                    {(!S || A.status === "conditional") && (A.reason || A.missing?.length > 0) && (
                      <p className="tag">{E(A.reason ?? "")}{A.missing?.map((m: any) => ` ${t.falta} (${kind(m.kind)}): ${E(m.item)}.`)}</p>
                    )}

                    <ul className="tag mt-2 list-none p-0">
                      {(run.explanationOrder as string[]).filter((k) => k !== "A").map((k) => (
                        <li key={k}><strong>{indName[k]}:</strong> {t.pending}.{" "}
                          <details className="inline"><summary className="inline cursor-pointer underline">{t.whatMissing}</summary>
                            <ul className="list-disc pl-5">{r.indicators[k].missing.map((m: any) => <li key={m.item}>{kind(m.kind)}: {E(m.item)}{m.note ? ` — ${E(m.note)}` : ""}</li>)}</ul>
                          </details></li>
                      ))}
                    </ul>
                    <p className="risk mt-2 text-sm">{t.overallMissing}{r.overall?.missing?.length ? `: ${t.missingIndicators} ${r.overall.missing.map((k: string) => (t as any)["ind" + k]).join(", ")}` : ""}</p>
                  </article>
                );
              })}
            </div>
            <p className="tag mt-2">{t.range}</p>
            {(() => {
              const notes: any[] = run.screening?.notes ?? [];
              const altCount = run.rotations.length - 1;
              const limits = altCount < 2 ? notes.filter((n) => n.code !== "intercrop_current") : [];
              const inter = notes.filter((n) => n.code === "intercrop_current");
              return (<>
                {limits.length > 0 && <p className="tag"><strong>{t.altLimit}:</strong> {limits.map((n) => reasonText(lang, n.code, n.params)).join(" ")}</p>}
                {inter.length > 0 && <p className="tag">{inter.map((n) => reasonText(lang, n.code, n.params)).join(" ")}</p>}
              </>);
            })()}
            <p className="tag"><strong>{t.soilUsed}:</strong> {run.soil?.active === "regional" ? t.srcRegional : run.soil?.active === "farmer" ? t.srcFarmer : run.soil?.active === "demo" ? t.srcDemo : t.soilUsedNone}</p>
            <p className="tag">{t.ksNote}</p>
            <details className="panel mt-3 p-4">
              <summary className="cursor-pointer font-semibold">{t.screeningTitle}</summary>
              <p className="tag mt-2">{t.reviewedNote}</p>
              <ul className="mt-2 list-none space-y-3 p-0">
                {run.screening.candidates.map((c: any) => (
                  <li key={c.sequence.join("-")} className="border-t border-line pt-2">
                    <strong>{c.sequence.map(cropLabel).join(" → ")}</strong>{" "}
                    <span className="border border-ink px-1 text-sm">{c.decision === "selected" ? t.decSelected : c.decision === "admitted_not_selected" ? t.decAdmitted : t.decDiscarded}</span>
                    <ul className="tag list-none p-0">
                      {c.checks.map((k: any, j: number) => (
                        <li key={j}>{k.status === "met" ? "✓" : k.status === "failed" ? "✗" : "–"} <em>{k.status === "met" ? t.stMet : k.status === "failed" ? t.stFailed : t.stNot}</em>: {reasonText(lang, k.code, k.params)}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
            {mgmtOrderNote(run, t)}

            <div className="panel mt-6 p-5">
              <h3 className="font-semibold">{t.calendarTitle}</h3>
              <ul className="num tag mt-1 flex flex-wrap gap-x-5">
                {run.calendar.candidates.map((c: any) => (
                  <li key={c.shiftDays}>{String(c.day).padStart(2, "0")}/{String(c.month).padStart(2, "0")} ({c.shiftDays > 0 ? "+" : ""}{c.shiftDays} d): {c.viable ? t.viable : t.notViable}</li>
                ))}
              </ul>
              {run.calendar.note && <p className="tag">{E(run.calendar.note)}</p>}
            </div>
            <details className="mt-2"><summary>{t.assumptions}</summary><ul className="tag list-disc pl-5">{run.assumptions.map((a: string) => <li key={a}>{E(a)}</li>)}</ul></details>

            <div className="panel mt-8 p-6">
              <h2 className="text-2xl font-semibold">{t.sim}</h2>
              {!simOn ? <button className="btn mt-3" onClick={() => setSimOn(true)}>{t.simStart}</button> : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col">{t.shift}: <span className="num">{shift > 0 ? "+" : ""}{shift}</span>
                    <input type="range" min={-30} max={30} value={shift} onChange={(e) => setShift(Number(e.target.value))} className="!min-h-[44px]" /></label>
                  <label className="flex flex-col">{t.rain}: <span className="num">{rain}%</span>
                    <input type="range" min={70} max={130} value={rain} onChange={(e) => setRain(Number(e.target.value))} className="!min-h-[44px]" /></label>
                  <p className="tag sm:col-span-2">{t.rainNote} · {t.notRecalc}: H, S, E, U</p>
                  <div className="flex items-center gap-3">
                    <button className="btn ghost" onClick={() => { setShift(0); setRain(100); setSimRun(null); }}>{t.reset}</button>
                    {simBusy && <span role="status">{t.computing}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-semibold">{t.methods}</h2>
              <p className="mt-1">{t.methodsText}</p>
              <button className="btn ghost mt-3" onClick={() => {
                const cur = simRun ?? run;
                const blob = new Blob([JSON.stringify(cur, null, 2)], { type: "application/json" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `heirloom-${cur.runId}.json`; a.click();
              }}>{t.export}</button>
            </div>
          </section>
        )}
        <p className="tag mt-12">{t.note}</p>
      </div>
    </main>
  );
}

function mgmtOrderNote(run: any, t: any) {
  const p = run.request?.management?.priority;
  return p ? <p className="tag">{t.orderNote}: {p === "water" ? t.pWater : p === "soil" ? t.pSoil : t.pMargin}</p> : null;
}
