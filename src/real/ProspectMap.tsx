import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DenuePoint } from './api';

export interface MapPlace {
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  inside: boolean;
}

interface Props {
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  onPick: (lat: number, lng: number) => void;
  denuePoints?: DenuePoint[];
  denueClasses?: string[];
  highlightClasses?: Set<number>;
  places?: MapPlace[];
}

const MX_CENTER: L.LatLngTuple = [23.6, -102.5];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export const ProspectMap: React.FC<Props> = ({
  center, radiusKm, onPick, denuePoints = [], denueClasses = [], highlightClasses, places = [],
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayer = useRef<L.LayerGroup | null>(null);
  const denueLayer = useRef<L.LayerGroup | null>(null);
  const placesLayer = useRef<L.LayerGroup | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const lastCenterKey = useRef<string>('');

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { center: MX_CENTER, zoom: 5, preferCanvas: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);
    renderer.current = L.canvas({ padding: 0.3 });
    denueLayer.current = L.layerGroup().addTo(map);
    placesLayer.current = L.layerGroup().addTo(map);
    baseLayer.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Pin de ubicación + círculo del radio
  useEffect(() => {
    const map = mapRef.current;
    const layer = baseLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!center) return;
    const ll = L.latLng(center.lat, center.lng);
    L.circle(ll, {
      radius: radiusKm * 1000, color: '#9333EA', weight: 2, fillColor: '#9333EA', fillOpacity: 0.06, dashArray: '6 6', interactive: false,
    }).addTo(layer);
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#9333EA;border:3px solid #fff;box-shadow:0 0 0 4px rgba(147,51,234,.35)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker(ll, { icon, draggable: true, title: 'Arrástrame para ajustar la ubicación' }).addTo(layer);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onPickRef.current(p.lat, p.lng);
    });
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${radiusKm}`;
    if (key !== lastCenterKey.current) {
      lastCenterKey.current = key;
      map.fitBounds(ll.toBounds(radiusKm * 2000 * 1.1), { animate: true });
    }
  }, [center?.lat, center?.lng, radiusKm]);

  // Puntos del DENUE (densidad)
  useEffect(() => {
    const layer = denueLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const hasHighlight = !!highlightClasses && highlightClasses.size > 0;
    for (const p of denuePoints) {
      const hot = hasHighlight && highlightClasses!.has(p[2]);
      if (hasHighlight && !hot) {
        L.circleMarker([p[0], p[1]], {
          renderer: renderer.current!, radius: 2.5, stroke: false, fillColor: '#64748B', fillOpacity: 0.25, interactive: false,
        }).addTo(layer);
        continue;
      }
      const m = L.circleMarker([p[0], p[1]], {
        renderer: renderer.current!, radius: hot ? 6 : 4, stroke: false, fillColor: hot ? '#F97316' : '#A855F7', fillOpacity: hot ? 0.55 : 0.3,
      });
      m.bindPopup(`<b>${escapeHtml(p[3] || 'Sin nombre')}</b><br><span style="font-size:11px">${escapeHtml(denueClasses[p[2]] || '')}</span><br><span style="font-size:10px;color:#666">Fuente: INEGI DENUE</span>`);
      m.addTo(layer);
    }
  }, [denuePoints, highlightClasses, denueClasses]);

  // Resultados de Apify (Google Maps)
  useEffect(() => {
    const layer = placesLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of places) {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7, color: '#fff', weight: 2, fillColor: p.inside ? '#10B981' : '#EF4444', fillOpacity: 0.95,
      });
      m.bindPopup(`<b>${escapeHtml(p.title)}</b><br><span style="font-size:11px">${escapeHtml(p.subtitle)}</span>${p.inside ? '' : '<br><span style="color:#EF4444;font-size:11px">Fuera del radio</span>'}`);
      m.addTo(layer);
    }
  }, [places]);

  return <div ref={elRef} className="w-full h-[420px] md:h-[520px] rounded-xl overflow-hidden border border-[#2D1B4E] z-0" />;
};
