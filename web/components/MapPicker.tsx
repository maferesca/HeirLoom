"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number | null; lon: number | null;
  onChange: (lat: number, lon: number) => void;
  unavailableText: string; failedText: string;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Loaded on demand (mapbox-gl is only imported when the component mounts with a token).
export default function MapPicker({ lat, lon, onChange, unavailableText, failedText }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const cb = useRef(onChange);
  const [failed, setFailed] = useState(false);
  cb.current = onChange;

  useEffect(() => {
    if (!TOKEN || !el.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !el.current) return;
        mapboxgl.accessToken = TOKEN;
        const map = new mapboxgl.Map({
          container: el.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [lon ?? -94.42, lat ?? 18.15],
          zoom: lat != null ? 12 : 5,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
        const place = (la: number, lo: number) => {
          if (!markerRef.current) {
            const m = new mapboxgl.Marker({ draggable: true, color: "#C89B50" }).setLngLat([lo, la]).addTo(map);
            m.on("dragend", () => { const p = m.getLngLat(); cb.current(p.lat, p.lng); });
            markerRef.current = m;
          } else markerRef.current.setLngLat([lo, la]);
        };
        map.on("click", (e) => { place(e.lngLat.lat, e.lngLat.lng); cb.current(e.lngLat.lat, e.lngLat.lng); });
        map.on("error", () => setFailed(true));
        if (lat != null && lon != null) place(lat, lon);
        mapRef.current = map;
      } catch { setFailed(true); }
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep map in sync when coordinates are typed or a place is chosen
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return;
    if (markerRef.current) markerRef.current.setLngLat([lon, lat]);
    else import("mapbox-gl").then(({ default: mb }) => {
      if (!mapRef.current || markerRef.current) return;
      const m = new mb.Marker({ draggable: true, color: "#C89B50" }).setLngLat([lon, lat]).addTo(mapRef.current);
      m.on("dragend", () => { const p = m.getLngLat(); cb.current(p.lat, p.lng); });
      markerRef.current = m;
    });
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 11), duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1200 });
  }, [lat, lon]);

  if (!TOKEN) return <p className="tag">{unavailableText}</p>;
  return (
    <>
      <div ref={el} className="h-[320px] w-full border border-line md:h-[420px]" role="application" aria-label="Map" />
      {failed && <p role="alert" className="risk text-sm">{failedText}</p>}
    </>
  );
}
