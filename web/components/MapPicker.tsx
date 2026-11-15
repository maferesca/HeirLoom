"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number | null; lon: number | null;
  onChange: (lat: number, lon: number) => void;
  unavailableText: string; failedText: string;
  /** Increments each time a locality is confirmed from the search: frames it at locality zoom. */
  flyToken?: number;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const LOCALITY_ZOOM = 12;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const valid = (a: number | null, b: number | null): a is number => a != null && b != null && isFinite(a) && isFinite(b);

// Loaded on demand (mapbox-gl is only imported when the component mounts with a token).
export default function MapPicker({ lat, lon, onChange, unavailableText, failedText, flyToken = 0 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const mbRef = useRef<typeof import("mapbox-gl").default | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const loadedRef = useRef(false);
  const latest = useRef({ lat, lon });
  const pendingFocus = useRef(false);
  const cb = useRef(onChange);
  const [failed, setFailed] = useState(false);
  cb.current = onChange;
  latest.current = { lat, lon };

  function ensureMarker(la: number, lo: number) {
    const map = mapRef.current, mb = mbRef.current;
    if (!map || !mb) return;
    if (markerRef.current) { markerRef.current.setLngLat([lo, la]); return; }
    const m = new mb.Marker({ draggable: true, color: "#C0603F" }).setLngLat([lo, la]).addTo(map);
    m.on("dragend", () => { const p = m.getLngLat(); cb.current(p.lat, p.lng); });
    markerRef.current = m;
  }

  // Frame the confirmed locality: marker visible and centered at locality zoom
  function frame(animate: boolean) {
    const map = mapRef.current; const { lat: la, lon: lo } = latest.current;
    if (!map || !valid(la, lo)) return;
    ensureMarker(la, lo!);
    map.resize();
    const opts = { center: [lo!, la] as [number, number], zoom: LOCALITY_ZOOM };
    if (animate && !reduced()) map.flyTo({ ...opts, duration: 900 }); else map.jumpTo(opts);
  }

  useEffect(() => {
    if (!TOKEN || !el.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !el.current) return;
        mbRef.current = mapboxgl;
        mapboxgl.accessToken = TOKEN;
        const { lat: la0, lon: lo0 } = latest.current;
        const map = new mapboxgl.Map({
          container: el.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [lo0 ?? -94.42, la0 ?? 18.15],
          zoom: valid(la0, lo0) ? LOCALITY_ZOOM : 5,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
        map.on("click", (e) => { ensureMarker(e.lngLat.lat, e.lngLat.lng); cb.current(e.lngLat.lat, e.lngLat.lng); });
        map.on("error", () => setFailed(true));
        map.on("load", () => {  // adjust the framing once the map is ready
          loadedRef.current = true;
          if (pendingFocus.current || valid(latest.current.lat, latest.current.lon)) { pendingFocus.current = false; frame(false); }
        });
        mapRef.current = map;
      } catch { setFailed(true); }
    })();
    return () => { cancelled = true; loadedRef.current = false; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typed coordinates or a dragged marker: keep the marker in sync (no re-zoom)
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current || !valid(lat, lon)) return;
    ensureMarker(lat, lon!);
    const map = mapRef.current;
    if (!map.getBounds()?.contains([lon!, lat])) map.flyTo({ center: [lon!, lat], zoom: Math.max(map.getZoom(), 11), duration: reduced() ? 0 : 900 });
     
  }, [lat, lon]);

  // A locality was confirmed from the search: center it at locality zoom
  useEffect(() => {
    if (!flyToken) return;
    if (!mapRef.current || !loadedRef.current) { pendingFocus.current = true; return; }
    frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToken]);

  if (!TOKEN) return <p className="tag">{unavailableText}</p>;
  return (
    <>
      <div ref={el} className="h-[320px] w-full border border-line md:h-[420px]" role="application" aria-label="Map" />
      {failed && <p role="alert" className="risk text-sm">{failedText}</p>}
    </>
  );
}
