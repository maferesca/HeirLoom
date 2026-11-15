/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { T, type Lang } from "@/lib/i18n";
import MapPicker from "./MapPicker";
import ClimateExplorer from "./ClimateExplorer";
import Reveal from "./Reveal";
import HelpedField from "./HelpedField";
import { initScrollScene, refreshScene } from "@/lib/scrollScene";
import { tr as trEng } from "@/lib/engineText";
import { reasonText, discardSentence } from "@/lib/screeningText";

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
  const [soilFeel, setSoilFeel] = useState("unknown");
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
  const [active, setActive] = useState(-1);
  const [placeName, setPlaceName] = useState("");
  const [flyToken, setFlyToken] = useState(0);

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

  // Jesus Carranza case: loads EVERY answer (nothing carried over from a previous run), fetches climate and
  // the SoilGrids profile and runs the base comparison, so the example is complete, editable and reproducible.
  async function runCase() {
    const L = { lat: 17.432993, lon: -95.02336 };
    setCycles([{ crop: "maize", also: "", approx: "" }, { crop: "bean", also: "", approx: "" }, { crop: "maize", also: "", approx: "" }]);
    setUsual({ m: "6", d: "15" }); setWinFrom({ m: "", d: "" }); setWinTo({ m: "", d: "" });
    setRegime("rainfed"); setIrrFrom({ m: "", d: "" }); setIrrTo({ m: "", d: "" }); setIrrDepth(""); setIrrEvery("");
    setAllowed(["maize", "bean"]); setCons({ seed: "", equipment: "", buyer: "" }); setBlocked({ seed: [], equip: [], buyer: [] });
    setMgmt({ residues: "unknown", cover: "unknown", waterlog: "unknown", runoff: "unknown", priority: "" }); setOpt({ area: "", costs: "" });
    setSoil({ fc: "", wp: "" }); setSoilSource(""); setSoilProf(null); setSoilFeel("unknown");
    chosenRef.current = t.caseName; setQ(t.caseName); setPlaces(null); setSearchMsg("");
    setCoords({ lat: String(L.lat), lon: String(L.lon), elev: "" }); setPlaceName(t.caseName); setFlyToken((n) => n + 1);
    confirmLocation(L.lat, L.lon, undefined, "map");
    setSoilProfState("loading");
    try {
      const sp = await post("/api/soil-profile", { location: L });
      setSoilProf(sp); setSoilProfState(sp.status === "ok" ? "idle" : "error");
      if (sp.status === "ok" && sp.hydraulics?.usable) {
        setSoilSource("regional");
        await compare({
          location: L, startYear: 2005, endYear: 2024,
          history: [{ crops: ["maize"] }, { crops: ["bean"] }, { crops: ["maize"] }], plantMonth: 6, plantDay: 15,
          waterRegime: "rainfed", allowedCrops: ["maize", "bean"], constraintNotes: { seed: "", equipment: "", buyer: "" },
          constraints: { seedUnavailable: [], equipmentUnsupported: [], noBuyer: [] }, management: { residues: "unknown" },
          soilIsDemo: false, soilSource: "regional", plantShiftDays: 0, precipScale: 1,
        });
      }
    } catch { setSoilProfState("error"); }
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

  // scroll-linked decorative layers (static with reduced motion)
  useEffect(() => initScrollScene(), []);
  useEffect(() => { const id = setTimeout(refreshScene, 60); return () => clearTimeout(id); }, [confirmed, profile, run, soilProf, simOn]);

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
    location: confirmed, startYear: 2005, endYear: 2024,
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
      priority: mgmt.priority || undefined, areaHa: num(opt.area), ownCostsMxnPerHa: num(opt.costs), soilFeel,
    },
    soil: (soilSource === "farmer" || soilSource === "demo") && num(soil.fc) != null && num(soil.wp) != null ? { thetaFC: num(soil.fc), thetaWP: num(soil.wp) } : undefined,
    soilIsDemo: soilSource === "demo",
    soilSource: soilSource || undefined,
  });

  async function compare(explicit?: any) {
    const bd = explicit ?? body();
    setRunState("loading"); setRunErr(""); setSimRun(null); setSimOn(false); setShift(0); setRain(100);
    try {
      setRun(await post("/api/rotation-comparison", bd)); setRunState("idle");
    } catch (e: any) { setRunState("error"); setRunErr(e.message === "422" ? "422" : ""); }
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
  const hasIntercrop = cycles.some((c) => c.also && c.also !== c.crop);
  const numLoc = lang === "es" ? "es-MX" : "en-US";
  const fmtMD = (md: number[]) => new Date(2001, md[0] - 1, md[1]).toLocaleDateString(numLoc, { day: "numeric", month: "short" }).replace(".", "");
  const candFor = (r: any) => (r?.sequence ? run?.screening?.candidates?.find((c: any) => c.sequence.join() === r.sequence.join()) : null);
  const scen = simOn && simRun ? simRun : null;  // only when the simulator has moved something
  const moved = !!(simOn && simRun && (shift !== 0 || rain !== 100));
  const calLabel = moved && shift !== 0 ? t.calScenario : t.calBase;
  const tlFor = (i: number) => (moved && shift !== 0 ? simRun?.rotations?.[i]?.timeline : run?.rotations?.[i]?.timeline) ?? run?.rotations?.[i]?.timeline;
  const covLine = () => {
    const c = run?.request?.management?.coverCrop;
    return c === true ? t.coverUnconfirmed : c === false ? t.coverNo : t.coverNoData;
  };
  const scenSentence = (b: any, sc: any, req: any) => {
    const pct = Math.round((req?.precipScale ?? 0.8) * 100), sh = req?.plantShiftDays ?? 0;
    const parts: string[] = [];
    if (pct !== 100) parts.push(t.scenDescRain.replace("{pct}", String(pct)));
    if (sh !== 0) parts.push(t.scenDescShift.replace("{n}", String(Math.abs(sh))).replace("{dir}", sh < 0 ? t.dirEarlier : t.dirLater));
    const desc = parts.join(lang === "es" ? " y " : " and ");
    const d = sc.medianA - b.medianA, dp = sc.p10 - b.p10;
    // on a 1-100 scale, a typical result that moves less than half a point "barely changes"
    if (d <= -0.5) return t.scenDown.replace("{desc}", desc).replace("{d}", Math.abs(d).toFixed(1)).replace("{p}", `${Math.abs(dp).toFixed(1)} ${lang === "es" ? "puntos" : "points"}`);
    if (d >= 0.5) return t.scenUp.replace("{desc}", desc).replace("{d}", d.toFixed(1));
    return (dp <= -0.3 ? t.scenSameLow : t.scenSame).replace("{desc}", desc);
  };
  const exportRun = () => {
    const cur = simOn && simRun ? simRun : run;
    const blob = new Blob([JSON.stringify(cur, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `heirloom-${cur.runId}.json`; a.click();
  };
  const reg = run?.soil?.sources?.regional;
  const soilLine = !run ? "" : run.soil?.active === "regional"
    ? (reg?.qualityFlags?.includes("nearest_valid_cell") ? t.soilLineRegional.replace("{m}", String(Math.round(reg.distanceM))) : t.soilLineRegionalExact)
    : run.soil?.active === "farmer" ? t.soilLineFarmer : run.soil?.active === "demo" ? t.soilLineDemo : "";
  const toggleCrop = (c: string) => setAllowed((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));
  const winBad = hasMD(winFrom) !== hasMD(winTo);

  const stepTitle = (n: string, k: string) => `${t.stepNo.replace("{n}", n)} · ${k}`;
  const regimeLabel = { rainfed: t.rainfed, irrigated: t.irrigated, both: t.both, unknown: t.unknownOpt }[regime];
  const soilChip = soilSource === "regional" ? t.srcRegional : soilSource === "farmer" ? t.srcFarmer : soilSource === "demo" ? t.srcDemo : t.unknown;
  const seqText = cycles.map((c) => [c.crop, c.also].filter(Boolean).map(cropLabel).join(" + ")).join(" → ");
  const chips = [
    { id: "step-1", label: t.chipHistory, value: seqText },
    { id: "step-2", label: t.chipDate, value: `${usual.d}/${usual.m}${hasMD(winFrom) && hasMD(winTo) ? ` (${winFrom.d}/${winFrom.m}–${winTo.d}/${winTo.m})` : ""}` },
    { id: "step-2", label: t.chipWater, value: regimeLabel },
    { id: "step-3", label: t.chipCrops, value: allowed.map(cropLabel).join(", ") || "—" },
    { id: "step-4", label: t.chipSoil, value: soilChip },
  ];
  const yn = (v: string) => (v === "yes" ? t.yesWord : t.noWord);
  const obsChips: { id: string; label: string; value: string }[] = [];
  if (soilFeel !== "unknown") obsChips.push({ id: "step-4", label: t.chipFeel, value: soilFeel === "gritty" ? t.feelGritty : soilFeel === "smooth" ? t.feelSmooth : t.feelSticky });
  if (mgmt.waterlog !== "unknown") obsChips.push({ id: "step-3", label: t.chipWet, value: `${yn(mgmt.waterlog)}${mgmt.waterlog === "yes" ? ` · ${t.chipWarn}` : ""}` });
  if (mgmt.runoff !== "unknown") obsChips.push({ id: "step-3", label: t.chipRun, value: `${yn(mgmt.runoff)}${mgmt.runoff === "yes" ? ` · ${t.chipWarn}` : ""}` });
  if (obsChips.length === 0) obsChips.push({ id: "step-3", label: t.chipObs, value: t.chipObsNone });
  const editStep = (id: string) => {
    scrollToId(id);
    setTimeout(() => (document.getElementById(id)?.querySelector("input,select,button") as HTMLElement | null)?.focus({ preventScroll: true }), motionOff() ? 0 : 500);
  };
  const StepHead = ({ n, title }: { n: number; title: string }) => (
    <><div className="step-no" aria-hidden>{n}</div><h3 className="t-sub self-center">{title}</h3></>
  );

  return (
    <main>
      <header className="absolute z-10 flex w-full items-center justify-between px-6 py-4 text-sm text-cream">
        <span className="t-head">heirloom</span>
        <Link href={`/${other}`} className="underline" hrefLang={other}>{other.toUpperCase()}</Link>
      </header>

      <section className="hero" data-scene>
        <div className="hero-art" data-parallax="0.18" aria-hidden />

        {/* a glass lens onto the fields seen from above, with thin orbit rings and dots (decorative) */}
        <div className="hero-orbit" data-parallax="-0.06" aria-hidden>
          <svg className="hero-rings" viewBox="0 0 200 200" fill="none">
            <g className="ring-a">
              <circle cx="100" cy="100" r="96" stroke="#E9B877" strokeOpacity=".5" strokeWidth=".5" />
              <circle cx="100" cy="4" r="1.7" fill="#F6D9A3" /><circle cx="183" cy="148" r="1.7" fill="#F6D9A3" /><circle cx="22" cy="146" r="1.7" fill="#F6D9A3" />
            </g>
            <g className="ring-b">
              <circle cx="100" cy="100" r="74" stroke="#E9B877" strokeOpacity=".4" strokeWidth=".5" />
              <circle cx="174" cy="100" r="1.5" fill="#E9B877" /><circle cx="48" cy="164" r="1.5" fill="#E9B877" />
            </g>
          </svg>
          <div className="hero-lens" />
        </div>

        <div className="hero-panel">
          <span className="hero-star" aria-hidden>✦</span>
          <h1>{t.heroTitleA}<em>{t.heroTitleB}</em></h1>
          <p className="hero-sub">{t.heroSub}</p>
          <form role="search" className="relative mt-8 max-w-xl" onSubmit={onSearchSubmit}>
            <label htmlFor="q" className="mb-2 block text-sm text-cream">{t.search}</label>
            <div className="search-pill">
              <input id="q" ref={inputRef} className="min-w-0 flex-1" value={q} onChange={(e) => { chosenRef.current = null; setQ(e.target.value); }} autoComplete="off"
                placeholder={t.searchEx} role="combobox" aria-expanded={!!places?.length} aria-controls="places" aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `place-${active}` : undefined}
                onKeyDown={(e) => {
                  if (!places?.length) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % places.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? places.length - 1 : i - 1)); }
                  else if (e.key === "Escape") { setPlaces(null); setActive(-1); }
                }} />
              <button type="submit" className="btn hero-search">{t.searchBtn}</button>
            </div>
            <div aria-live="polite" className="mt-2 min-h-5 text-sm text-cream">{searchMsg}</div>
            {places && places.length > 0 && (
              <ul id="places" role="listbox" className="panel absolute left-0 right-0 z-20 mt-1 max-h-64 list-none overflow-auto p-0 shadow-md">
                {places.map((p, i) => (
                  <li key={i} id={`place-${i}`} role="option" aria-selected={i === active} className="opt flex min-h-[44px] cursor-pointer items-center px-4"
                    onMouseEnter={() => setActive(i)} onClick={() => choose(p)}>{p.full || p.name}</li>
                ))}
              </ul>
            )}
          </form>
          <div className="mt-3"><button type="button" className="btn ghost" onClick={runCase}>{t.heroCase}</button></div>
        </div>
        <span className="hero-caption">{t.illusShort}</span>
      </section>

      <div className="flow">
        {/* ---- 01 · Locate your land: the furrows of the cover come back as contour curves around the map ---- */}
        <section id="map-section" aria-labelledby="loc" className="band scroll-mt-4" data-scene>
          <div className="layer-host" aria-hidden>
            <div className="layer layer-rings" data-parallax="0.12" data-fade data-opacity="0.6"><i /></div>
            <div className="layer layer-rings hide-sm" data-parallax="-0.07" data-fade data-opacity="0.28" style={{ top: "38%" }}><i /></div>
          </div>
          <div className="inner">
            <p className="eyebrow">{stepTitle("01", t.stepLocate)}</p>
            <div className="panel p-5 md:p-6">
              <h2 id="loc" className="t-section">{t.placeMap}</h2>
              {placeName && <p className="t-head mt-1" aria-live="polite">{t.placeConfirmed}: {placeName}</p>}
              <div className="mt-2"><MapPicker lat={isFinite(parseFloat(coords.lat)) ? parseFloat(coords.lat) : null} lon={isFinite(parseFloat(coords.lon)) ? parseFloat(coords.lon) : null}
                onChange={(la, lo) => setCoords((c) => ({ ...c, lat: la.toFixed(5), lon: lo.toFixed(5) }))} unavailableText={t.mapUnavailable} failedText={t.mapFailed} flyToken={flyToken} /></div>
              {confirmed && <p className="mt-3"><a href="#known" className="t-head underline" onClick={goClimate}>{t.seeClimate} ↓</a></p>}
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
            </div>
          </div>
        </section>

        {/* ---- 02 · Discover its climate: contours soften into long flowing lines ---- */}
        {confirmed && (
          <section id="known" aria-labelledby="kn" className="band scroll-mt-4" data-scene>
            <div className="layer-host" aria-hidden>
              <div className="layer layer-flow" data-parallax="0.07" data-fade data-opacity="0.2"><i /></div>
            </div>
            <div className="inner">
              <Reveal>
                <ClimateExplorer lang={lang} t={t} months={months} period={profile?.period ?? [2005, 2024]} profile={profile} state={profileState}
                  onRetry={() => loadProfile()} onLoad={() => loadProfile()} coords={`${confirmed.lat.toFixed(4)}, ${confirmed.lon.toFixed(4)}`} />
              </Reveal>
            </div>
          </section>
        )}

        {/* ---- 03 · Tell us how you plant: steps that continue from the climate, quiet lines behind ---- */}
        {profile && (
          <section id="ask" aria-labelledby="ask-h" className="band scroll-mt-4" data-scene>
            <div className="layer-host" aria-hidden>
              <div className="layer layer-flow" data-parallax="-0.05" data-fade data-opacity="0.12" style={{ top: "12%" }}><i /></div>
            </div>
            <div className="inner">
              <p className="eyebrow">{stepTitle("03", t.stepSow)}</p>
              <h2 id="ask-h" className="t-section">{t.tell}</h2>

              <nav className="answers mt-4" aria-label={t.answersTitle}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tag mr-1">{t.answersTitle}</span>
                  {[...chips, ...obsChips].map((c, i) => (
                    <button key={i} type="button" className="chip" onClick={() => editStep(c.id)} aria-label={`${c.label}: ${c.value}. ${t.editWord}`}>
                      <small>{c.label}</small><span>{c.value}</span>
                    </button>
                  ))}
                </div>
              </nav>

              <div className="mt-8">
                <Reveal><div className="step" id="step-1">
                  <StepHead n={1} title={t.step1Title} />
                  <div className="calm col-start-2 mt-3 p-5">
                    <fieldset><legend className="t-head">{t.q1}</legend>
                      <p className="tag">{t.q1h}</p>
                      {cycles.map((c, i) => (
                        <div key={i} className="mt-3 flex flex-wrap items-end gap-3">
                          <span className="tag w-16">{t.cycle} {i + 1}</span>
                          <label className="flex flex-col text-sm">{t.crop}
                            <select value={c.crop} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, crop: e.target.value, also: x.also === e.target.value ? "" : x.also } : x)))}>
                              <option value="maize">{t.maize}</option><option value="bean">{t.bean}</option>
                            </select></label>
                          <label className="flex flex-col text-sm">{t.alsoWith}
                            <select value={c.also} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, also: e.target.value } : x)))}>
                              <option value="">{t.none}</option>{(["maize", "bean"] as const).filter((x) => x !== c.crop).map((x) => <option key={x} value={x}>{cropLabel(x)}</option>)}
                            </select></label>
                          <label className="flex flex-col text-sm">{t.approx}
                            <input type="date" max={new Date().toISOString().slice(0, 10)} value={c.approx} onChange={(e) => setCycles(cycles.map((x, j) => (j === i ? { ...x, approx: e.target.value } : x)))} /></label>
                          {cycles.length > 1 && <button className="btn ghost" onClick={() => setCycles(cycles.filter((_, j) => j !== i))}>{t.removeCycle}</button>}
                        </div>
                      ))}
                      {cycles.length < 5 && <button className="btn ghost mt-3" onClick={() => setCycles([...cycles, { crop: "maize", also: "", approx: "" }])}>{t.addCycle}</button>}
                      {hasIntercrop && <p role="status" className="risk mt-2 text-sm">{t.intercropWarn}</p>}
                    </fieldset>
                  </div>
                </div></Reveal>

                <Reveal><div className="step" id="step-2">
                  <StepHead n={2} title={t.step2Title} />
                  <div className="calm col-start-2 mt-3 p-5">
                    <fieldset><legend className="t-head">{t.q2}</legend>
                      <div className="mt-2 flex flex-wrap items-start gap-4">
                        <MDInput v={usual} set={setUsual} label={t.usual} />
                        <HelpedField label={t.winLabel} help={{ title: t.helpName, question: t.helpWinQ, tip: t.helpWinTip }}
                          helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow}>
                          <div className="flex flex-wrap gap-4"><MDInput v={winFrom} set={setWinFrom} label={t.winFrom} /><MDInput v={winTo} set={setWinTo} label={t.winTo} /></div>
                        </HelpedField>
                      </div>
                      <p className="tag mt-1">{t.winOpt}</p>
                      {winBad && <p role="alert" className="risk text-sm">{t.winFrom} / {t.winTo}</p>}
                    </fieldset>
                    <fieldset className="mt-6"><legend className="t-head">{t.q3}</legend>
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
                  </div>
                </div></Reveal>

                <Reveal><div className="step" id="step-3">
                  <StepHead n={3} title={t.step3Title} />
                  <div className="calm col-start-2 mt-3 p-5">
                    <fieldset><legend className="t-head">{t.q4}</legend>
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
                    <fieldset className="mt-6"><legend className="t-head">{t.q5}</legend>
                      <div className="mt-2 flex flex-wrap items-start gap-4">
                        <HelpedField label={t.residues} value={mgmt.residues} onChange={(v) => setMgmt({ ...mgmt, residues: v })}
                          options={[{ value: "unknown", label: t.unknown }, { value: "retain", label: t.resRetain }, { value: "partial", label: t.resPartial }, { value: "remove", label: t.resRemove }]}
                          help={{ title: t.helpName, question: t.helpResQ, tip: t.helpResTip }} helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow} />
                        <HelpedField label={t.cover} value={mgmt.cover} onChange={(v) => setMgmt({ ...mgmt, cover: v })}
                          options={[{ value: "unknown", label: t.unknown }, { value: "yes", label: t.yes }, { value: "no", label: t.no }]}
                          help={{ title: t.helpName, question: t.helpCoverQ, tip: t.helpCoverTip }} helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow} />
                        <HelpedField label={t.wetLabel} value={mgmt.waterlog} onChange={(v) => setMgmt({ ...mgmt, waterlog: v })}
                          options={[{ value: "unknown", label: t.unknown }, { value: "yes", label: t.yes }, { value: "no", label: t.no }]}
                          help={{ title: t.helpName, question: t.helpWetQ, tip: t.helpWetTip }} helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow} />
                        <HelpedField label={t.runLabel} value={mgmt.runoff} onChange={(v) => setMgmt({ ...mgmt, runoff: v })}
                          options={[{ value: "unknown", label: t.unknown }, { value: "yes", label: t.yes }, { value: "no", label: t.no }]}
                          help={{ title: t.helpName, question: t.helpRunQ, tip: t.helpRunTip }} helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow} />
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
                  </div>
                </div></Reveal>

                <Reveal><div className="step" id="step-4">
                  <StepHead n={4} title={t.step4Title} />
                  <div className="calm col-start-2 mt-3 p-5">
                    <p className="t-head">{t.soilTech}</p>
                    <p className="tag">{t.soilHelp}</p>
                    <div className="mt-3">
                      <HelpedField label={t.soilFeelLabel} value={soilFeel} onChange={setSoilFeel}
                        options={[{ value: "unknown", label: t.unknown }, { value: "gritty", label: t.feelGritty }, { value: "smooth", label: t.feelSmooth }, { value: "sticky", label: t.feelSticky }]}
                        help={{ title: t.helpName, question: t.helpSoilQ, tip: t.helpSoilTip }} helpName={t.helpName} closeText={t.helpClose} noKnowText={t.helpNoKnow} />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="calm p-3 text-sm">
                          <p className="t-head">{t.obsRegionalTitle}</p>
                          {soilProf?.status === "ok" ? (<>
                            <p className="num">{t.obsRegionalLine.replace("{depth}", soilProf.layers[0].label).replace("{clay}", soilProf.layers[0].clay_pct.toFixed(1)).replace("{sand}", soilProf.layers[0].sand_pct.toFixed(1)).replace("{soc}", soilProf.layers[0].soc_g_kg.toFixed(1))}</p>
                            <p className="tag">{t.obsRegionalSrc.replace("{m}", String(Math.round(soilProf.distanceM ?? 0)))}</p></>) : <p className="tag">{t.obsRegionalNone}</p>}
                        </div>
                        <div className="calm p-3 text-sm">
                          <p className="t-head">{t.obsFarmerTitle}</p>
                          <p>{soilFeel === "gritty" ? t.feelGritty : soilFeel === "smooth" ? t.feelSmooth : soilFeel === "sticky" ? t.feelSticky : t.obsFarmerNone}</p>
                          <p className="tag">{t.obsFarmerSrc.replace("{source}", soilSource === "regional" ? t.srcRegional : soilSource === "farmer" ? t.srcFarmer : soilSource === "demo" ? t.srcDemo : t.soilUsedNone)}</p>
                        </div>
                      </div>
                    </div>
                    <p className="t-head mt-4">{t.soilSourceTitle}</p>
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

                    {soilSource !== "regional" && (
                      <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3">
                        <label className="flex flex-col text-sm">{t.fc}<input inputMode="decimal" value={soil.fc} onChange={(e) => { setSoil({ ...soil, fc: e.target.value }); setSoilSource("farmer"); }} placeholder={t.unknown} /></label>
                        <label className="flex flex-col text-sm">{t.wp}<input inputMode="decimal" value={soil.wp} onChange={(e) => { setSoil({ ...soil, wp: e.target.value }); setSoilSource("farmer"); }} placeholder={t.unknown} /></label>
                        <button className="btn ghost self-end" onClick={() => { setSoil({ fc: "", wp: "" }); setSoilSource(""); }}>{t.unknown}</button>
                      </div>
                    )}
                    {soilSource === "demo" && <p className="tag mt-2" role="note">{t.demoTag}</p>}
                    {!soilSource && <p className="risk mt-2 text-sm">{t.soilNeed}</p>}
                  </div>
                </div></Reveal>

                <button className="btn" onClick={() => compare()} disabled={runState === "loading" || winBad}>{runState === "loading" ? t.computing : t.compute}</button>
                {runState === "error" && <p role="alert" className="risk mt-2">{runErr === "422" ? `${t.winFrom} / ${t.usual}` : t.apiDown}</p>}
              </div>
            </div>
          </section>
        )}

        {/* ---- 04 · Explore what to plant in each cycle: aligned cycles, plain-language reasons, simulator next to them ---- */}
        {run && (
          <section id="results" aria-labelledby="cmp" className="band scroll-mt-4" data-scene>
            <div className="inner">
              <p className="eyebrow">{stepTitle("04", t.stepExplore)}</p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="cmp" tabIndex={-1} className="t-section">{t.cmpTitle}</h2>
                <div className="flex flex-wrap gap-2">
                  <a href="#methods" className="btn ghost inline-flex items-center" onClick={(e) => { e.preventDefault(); scrollToId("methods"); }}>{t.howLink}</a>
                  <button className="btn ghost" onClick={exportRun}>{t.exportNow}</button>
                </div>
              </div>
              <p className="tag">{t.mode}</p>
              {run.warnings?.length > 0 && <ul className="risk mt-2 list-disc pl-5 text-sm" role="status">{run.warnings.map((w: string) => <li key={w}>{E(w)}</li>)}</ul>}
              {simRun?.calendar?.scenarioOutsideWindow && <p role="alert" className="risk mt-2 text-sm">{t.outsideWindow}</p>}

              {/* notices that apply to every option are shown once */}
              {(() => {
                const cur = run.rotations[0];
                const prio = run.request?.management?.priority;
                const common: string[] = [];
                if (soilLine) common.push(`${soilLine}${run.soil?.active === "regional" ? ` (${lang === "es" ? "no es una medición de tu parcela" : "not a measurement of your plot"})` : ""}.`);
                common.push(t.commonPending);
                common.push(t.commonNotEval);
                if (!run.calendar?.window) common.push(t.whyNoWindow);
                if (cur.structure === "intercrop") common.push(t.commonIntercrop);
                if (prio === "margin") common.push(t.commonMargin);
                if (prio === "soil") common.push(t.commonSoilPrio);
                const techKeys = ["H", "S", "E", "U"];
                return (
                  <div className="calm mt-5 p-4">
                    <p className="t-head">{t.commonTitle}</p>
                    <ul className="mt-1 list-disc pl-5">{common.map((x) => <li key={x}>{x}</li>)}</ul>
                    <details className="mt-2">
                      <summary className="tag cursor-pointer underline">{t.showDetails}</summary>
                      <ul className="tag mt-2 list-none p-0">
                        {techKeys.map((k) => (
                          <li key={k} className="mt-1"><strong>{indName[k]}:</strong> {t.pending}
                            <ul className="list-disc pl-5">{cur.indicators[k].missing.map((m: any) => <li key={m.item}>{kind(m.kind)}: {E(m.item)}{m.note ? ` — ${E(m.note)}` : ""}</li>)}</ul></li>
                        ))}
                      </ul>
                      <p className="tag mt-2">{t.range}</p>
                    </details>
                  </div>
                );
              })()}

              {(() => {
                const nCols = Math.max(1, ...run.rotations.map((r: any) => (r.sequence ?? r.history ?? []).length));
                const cur = run.rotations[0];
                const curSeq: string[] | null = cur.sequence;
                return (
                  <div className="mt-6" style={{ ["--cols" as any]: nCols }}>
                    <p className="tag mb-1"><strong>{calLabel}</strong></p>
                    <div className="cycles-head" aria-hidden><span className="lead">{t.whatPlant}</span>{Array.from({ length: nCols }).map((_, j) => <span key={j}>{t.cycle} {j + 1}</span>)}</div>
                    {run.rotations.map((r: any, i: number) => {
                      const base = r.indicators.A;
                      const bS = base.summary;
                      const sS = scen?.rotations?.[i]?.indicators?.A?.summary;
                      const sReq = scen?.request;
                      const cells: { c: string; text: string }[] = r.sequence
                        ? r.sequence.map((c: string) => ({ c, text: cropLabel(c) }))
                        : (r.history ?? []).map((h: any) => ({ c: h.crops.length > 1 ? "mixed" : h.crops[0], text: h.crops.map(cropLabel).join(" + ") }));
                      const tl = tlFor(i);
                      const cand = candFor(r);
                      const checks: any[] = (i === 0 ? run.screening?.current?.checks : cand?.checks) ?? [];
                      const chk = (name: string) => checks.find((c) => c.check === name);
                      const diffs = i > 0 && curSeq && r.sequence
                        ? r.sequence.map((c: string, j: number) => (c !== curSeq[j] ? `${t.cycle} ${j + 1}: ${cropLabel(curSeq[j])} → ${cropLabel(c)}` : null)).filter(Boolean) as string[]
                        : null;
                      const uniq = r.sequence ? Array.from(new Set(r.sequence as string[])) : [];
                      const ov = chk("overlap"), av = chk("availability");
                      const crops = (av?.params?.crops ?? uniq).map((x: string) => cropLabel(x).toLowerCase()).join(lang === "es" ? " y " : " and ");
                      const why = i === 0
                        ? t.yourRecord
                        : ov?.status === "met" ? t.whyOne.replace("{crops}", crops) : t.whyOneNoOverlap.replace("{crops}", crops);
                      return (
                        <article key={r.id} className="row-card">
                          <div className="cycle-row">
                            <div className="lead">
                              <h3 className="t-sub">{label(r, i)}</h3>
                              {r.structure && <span className="mt-1 inline-block border border-ink px-1.5 text-sm">{r.structure === "monoculture" ? t.monoculture : r.structure === "intercrop" ? t.structIntercrop : t.structRotation}</span>}
                            </div>
                            {Array.from({ length: nCols }).map((_, j) => cells[j]
                              ? <span key={j} className="crop-chip" data-crop={cells[j].c}>{cells[j].text}</span>
                              : <span key={j} />)}
                          </div>
                          {tl?.status === "ok" && (
                            <div className="cycle-row mt-1" aria-label={calLabel}>
                              <span className="lead-empty" />
                              {Array.from({ length: nCols }).map((_, j) => tl.cycles[j]
                                ? <span key={j} className="num text-center text-sm text-muted"><span className="block">{t.plantWord} {fmtMD(tl.cycles[j].plant)}</span><span className="block">{t.harvestWord} {fmtMD(tl.cycles[j].harvest)}</span></span>
                                : <span key={j} />)}
                            </div>
                          )}

                          <div className="mt-4 space-y-3 md:pl-[178px]">
                            <div>
                              <p className="t-head">{t.whyHere}</p>
                              <p >{why}</p>
                            </div>
                            <div aria-live="polite">
                              <p className="t-head">{t.whatChanges}</p>
                              {bS && sS ? (
                                <>
                                  <p className="num t-strong"><strong>{t.baseWord}:</strong> {bS.medianA.toFixed(1)}/100 · <strong>{t.scenarioWord}:</strong> {sS.medianA.toFixed(1)}/100 <span className="tag">({signed(sS.medianA - bS.medianA)})</span></p>
                                  <p >{scenSentence(bS, sS, sReq)}</p>
                                  {simBusy && <p className="tag" role="status">{t.computing}</p>}
                                </>
                              ) : bS ? (
                                <>
                                  <p className="num t-strong"><strong>{t.baseWord}:</strong> {bS.medianA.toFixed(1)}/100</p>
                                  <p className="tag">{simOn && simBusy ? t.computing : t.moveHint}</p>
                                </>
                              ) : (
                                <p >{base.status === "pending" && r.structure === "intercrop" ? t.waterPendingShort : E(base.reason ?? "")}</p>
                              )}
                            </div>
                            <details>
                              <summary className="tag cursor-pointer underline">{t.showDetails}</summary>
                              <div className="mt-2 space-y-2 text-sm">
                                {i > 0 && (
                                  <div>
                                    <p className="t-head">{t.changesTitle}</p>
                                    {diffs === null ? <p className="tag">{t.currentIntercropNote}</p>
                                      : diffs.length ? <ul className="tag list-disc pl-5">{diffs.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="tag">{t.sameAsCurrent}</p>}
                                  </div>
                                )}
                                {i > 0 && ov?.status === "met" && <p className="tag">{t.whyMargin.replace("{gap}", String(ov.params.minGapDays))}</p>}
                                {i > 0 && <p className="tag">{curSeq ? t.whyRank : t.whyIntercrop}</p>}
                                <p className="num"><strong>{indName.A}:</strong>{" "}
                                  {bS ? <>{t.median} {bS.medianA.toFixed(1)}/100 · P10–P90 {bS.p10.toFixed(1)}–{bS.p90.toFixed(1)} · {bS.validBlocks}/{bS.totalBlocks} {t.valid}</> : t.pending}</p>
                                {bS && sS && <p className="tag">{t.scenDetails.replace("{m0}", bS.medianA.toFixed(2)).replace("{p0}", bS.p10.toFixed(2)).replace("{m1}", sS.medianA.toFixed(2)).replace("{p1}", sS.p10.toFixed(2)).replace("{raw}", (sS.medianA - bS.medianA).toFixed(4))}</p>}
                                {base.status === "conditional" && <p className="risk">{t.conditional}</p>}
                                {base.conditions?.length > 0 && <ul className="tag list-disc pl-5">{base.conditions.map((c: string) => <li key={c}>{E(c)}</li>)}</ul>}
                                {!bS && (base.reason || base.missing?.length > 0) && <p className="tag">{E(base.reason ?? "")}{base.missing?.map((m: any) => ` ${t.falta} (${kind(m.kind)}): ${E(m.item)}.`)}</p>}
                              </div>
                            </details>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })()}

              {/* simulator right next to the comparison so its effects read in the same context */}
              <div className="panel mt-6 p-5 md:p-6">
                <h2 className="t-sub">{t.sim}</h2>
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

              {/* options that do not appear, with the engine's reason */}
              {(() => {
                const disc: any[] = (run.screening?.candidates ?? []).filter((c: any) => c.decision === "discarded");
                return (
                  <div className="mt-8">
                    <h3 className="t-sub">{t.discardTitle}</h3>
                    {disc.length === 0 ? <p className="tag mt-1">{t.discardNone}</p> : (
                      <ul className="mt-2 list-none space-y-2 p-0">
                        {disc.slice(0, 6).map((c) => {
                          const f = c.checks.find((k: any) => k.status === "failed");
                          return <li key={c.sequence.join("-")} className="calm p-3"><strong>{c.sequence.map(cropLabel).join(" → ")}</strong>: {f ? discardSentence(lang, f.code, f.params) : ""}</li>;
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* between harvest and planting: calendar and management, no carbon/erosion estimate */}
              <div className="mt-10" id="between">
                <h3 className="t-sub">{t.betweenTitle}</h3>
                <p className="tag">{t.betweenIntro}</p>
                <p className="mt-2"><strong>{t.mgmtResidues}:</strong> {(t.resNames as any)[run.request?.management?.residues ?? "unknown"]} · <strong>{t.mgmtCover}:</strong> {(t.yesNoNames as any)[run.request?.management?.coverCrop === true ? "yes" : run.request?.management?.coverCrop === false ? "no" : "unknown"]}</p>
                <p className="tag">{t.mgmtNote}</p>
                <p className="tag mt-1"><strong>{calLabel}</strong></p>
                <div className="mt-4 space-y-6">
                  {run.rotations.map((r: any, i: number) => {
                    const tl = tlFor(i);
                    return (
                      <div key={r.id}>
                        <p className="t-head">{label(r, i)}</p>
                        {tl?.status !== "ok" ? (
                          <p className="tag">{(tl?.missing ?? []).map((m: any) => `${t.needData} ${E(m.item)}`).join(" ")}</p>
                        ) : (
                          <>
                            <div className="mt-1 flex gap-1" role="img" aria-label={tl.cycles.map((c: any) => cropLabel(c.crop)).join(" → ")}>
                              {tl.cycles.map((c: any, j: number) => (
                                <div key={j} className="flex min-w-0" style={{ flex: c.cycleDays + (c.gapDays ?? 0) }}>
                                  <div className="crop-chip !min-h-[40px]" data-crop={c.crop} style={{ flex: c.cycleDays }}>{cropLabel(c.crop)}</div>
                                  {c.gapDays != null && <div className="gap-seg num" style={{ flex: c.gapDays }}>{t.gapDays.replace("{n}", String(c.gapDays))}</div>}
                                </div>
                              ))}
                            </div>
                            <ul className="tag mt-1 list-none p-0">
                              {tl.cycles.filter((c: any) => c.gapDays != null).map((c: any, j: number) => (
                                <li key={j}>{t.cycle} {j + 1} → {j + 2}: {t.gapDays.replace("{n}", String(c.gapDays))}, {t.gapRange.replace("{a}", fmtMD(c.gapFrom)).replace("{b}", fmtMD(c.gapTo))}. {covLine()}.</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="tag mt-3">{t.lastCycleNote} {t.soilPending}</p>
              </div>

              {(() => {
                const notes: any[] = run.screening?.notes ?? [];
                const altCount = run.rotations.length - 1;
                const limits = altCount < 2 ? notes.filter((n) => n.code !== "intercrop_current") : [];
                return (<div className="mt-6">
                  {limits.length > 0 && <p className="tag"><strong>{t.altLimit}:</strong> {limits.map((n) => reasonText(lang, n.code, n.params)).join(" ")}</p>}
                </div>);
              })()}
              <p className="tag"><strong>{t.soilUsed}:</strong> {run.soil?.active === "regional" ? t.srcRegional : run.soil?.active === "farmer" ? t.srcFarmer : run.soil?.active === "demo" ? t.srcDemo : t.soilUsedNone}</p>
              <p className="tag">{t.ksNote}</p>
              <details className="calm mt-3 p-4">
                <summary className="t-head cursor-pointer">{t.screeningTitle}</summary>
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

              <div className="calm mt-4 p-4">
                <h3 className="t-head">{t.calendarTitle}</h3>
                <ul className="num tag mt-1 flex flex-wrap gap-x-5">
                  {run.calendar.candidates.map((c: any) => (
                    <li key={c.shiftDays}>{String(c.day).padStart(2, "0")}/{String(c.month).padStart(2, "0")} ({c.shiftDays > 0 ? "+" : ""}{c.shiftDays} d): {c.viable ? t.viable : t.notViable}</li>
                  ))}
                </ul>
                {run.calendar.note && <p className="tag">{E(run.calendar.note)}</p>}
              </div>
              <details className="mt-2"><summary>{t.assumptions}</summary><ul className="tag list-disc pl-5">{run.assumptions.map((a: string) => <li key={a}>{E(a)}</li>)}</ul></details>

              <div className="mt-8" id="methods">
                <h2 className="t-sub">{t.methods}</h2>
                <p className="mt-1 max-w-3xl">{t.methodsText}</p>
                <button className="btn ghost mt-3" onClick={exportRun}>{t.export}</button>
              </div>
            </div>
          </section>
        )}
        <div className="band !py-8"><div className="inner"><p className="tag">{t.note}</p></div></div>
      </div>
    </main>
  );
}

function mgmtOrderNote(run: any, t: any) {
  const p = run.request?.management?.priority;
  return p ? <p className="tag">{t.orderNote}: {p === "water" ? t.pWater : p === "soil" ? t.pSoil : t.pMargin}</p> : null;
}
