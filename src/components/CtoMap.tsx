import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { capacidadeBoa, numeroCto, type Cto } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

type Props = {
  ctos: Cto[];
  selectedId?: string | null;
  onSelect?: (c: Cto) => void;
  userPos?: { lat: number; lng: number } | null;
  focus?: { lat: number; lng: number; zoom?: number } | null;
  interactive?: boolean;
  className?: string;
};

const ARACATI: [number, number] = [-4.5617, -37.7697];

export function CtoMap({ ctos, selectedId, onSelect, userPos, focus, interactive = true, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const userMarker = useRef<Leaflet.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const lf = (mod.default ?? mod) as typeof Leaflet;
      L.current = lf;
      const m = lf.map(el.current, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        keyboard: interactive,
      }).setView(focus ? [focus.lat, focus.lng] : ARACATI, focus?.zoom ?? 15);
      lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(m);
      layer.current = lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
      setTimeout(() => m.invalidateSize(), 50);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lf = L.current;
    if (!ready || !lf || !layer.current) return;
    layer.current.clearLayers();
    ctos.forEach((c) => {
      const cls = !c.ativa ? "cto-pin--off" : capacidadeBoa(c) ? "cto-pin--ok" : "cto-pin--full";
      const icon = lf.divIcon({
        className: "",
        html: `<div class="cto-pin ${cls} ${c.id === selectedId ? "cto-pin--selected" : ""}"><span>${numeroCto(c.codigo)}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [4, 34],
      });
      const mk = lf.marker([c.lat, c.lng], { icon, title: c.codigo, keyboard: interactive, zIndexOffset: c.id === selectedId ? 1000 : 0 });
      if (interactive) mk.on("click", () => onSelectRef.current?.(c));
      mk.addTo(layer.current!);
    });
  }, [ctos, selectedId, ready, interactive]);

  useEffect(() => {
    const lf = L.current;
    if (!ready || !lf || !map.current) return;
    userMarker.current?.remove();
    if (userPos) {
      userMarker.current = lf
        .marker([userPos.lat, userPos.lng], {
          icon: lf.divIcon({ className: "", html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: "Sua posição",
          zIndexOffset: 2000,
        })
        .addTo(map.current);
    }
  }, [userPos, ready]);

  useEffect(() => {
    if (!ready || !map.current || !focus) return;
    map.current.setView([focus.lat, focus.lng], focus.zoom ?? map.current.getZoom(), { animate: true });
  }, [focus, ready]);

  return <div ref={el} className={cn("h-full w-full", className)} role="application" aria-label="Mapa de CTOs" />;
}
