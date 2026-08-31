import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Lead } from '../types';

interface TerritoryMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  leads?: Lead[];
  densityPoints?: { lat: number; lng: number; nombre: string; categoria: string; calificacion: number }[];
  baseLocation?: { lat: number; lng: number; nombre: string; radioKm: number };
  gridCells?: { lat: number; lon: number; radio_celda_km: number }[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: Lead) => void;
}

export const TerritoryMap: React.FC<TerritoryMapProps> = ({
  centerLat,
  centerLng,
  zoom = 11,
  leads = [],
  densityPoints = [],
  baseLocation,
  gridCells = [],
  selectedLeadId,
  onSelectLead
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: zoom,
        zoomControl: true,
        attributionControl: false
      });

      // Dark Matter CartoDB / OpenStreetMap tiles that blend with the dark purple theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([centerLat, centerLng], zoom);
    }

    return () => {
      // Keep map alive during simple state updates or cleanup on unmount
    };
  }, []);

  // Update view when center changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], zoom);
    }
  }, [centerLat, centerLng, zoom]);

  // Update markers when leads, base, cells or density points change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    const bounds = L.latLngBounds([]);

    // 1. Render Base de Operaciones y Radio de Operación
    if (baseLocation && baseLocation.lat && baseLocation.lng) {
      const baseLatLng = L.latLng(baseLocation.lat, baseLocation.lng);
      bounds.extend(baseLatLng);

      // Círculo de radio de operación
      const opCircle = L.circle(baseLatLng, {
        radius: baseLocation.radioKm * 1000,
        color: '#9333EA',
        weight: 2,
        fillColor: '#9333EA',
        fillOpacity: 0.12,
        dashArray: '6, 6'
      });
      opCircle.bindPopup(`
        <div style="font-family: 'Poppins', sans-serif; color: #1E1B2E; padding: 4px;">
          <div style="font-weight: 700; color: #6B21A8;">🎯 Radio de Operación</div>
          <div style="font-size: 11px;">Cobertura: <b>${baseLocation.radioKm} km</b> a la redonda</div>
        </div>
      `);
      opCircle.addTo(markersLayerRef.current);

      // Marcador de Base
      const baseIcon = L.divIcon({
        className: 'custom-base-pin',
        html: `
          <div style="
            background: #9333EA;
            color: white;
            font-size: 14px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 15px rgba(147, 51, 234, 0.8);
            cursor: pointer;
          ">
            ⭐
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const baseMarker = L.marker(baseLatLng, { icon: baseIcon });
      baseMarker.bindPopup(`
        <div style="font-family: 'Poppins', sans-serif; color: #1E1B2E; padding: 4px;">
          <div style="font-weight: 700; font-size: 13px; color: #6B21A8;">⭐ Mi Base de Operaciones</div>
          <div style="font-size: 11px; margin-top: 2px;">${baseLocation.nombre}</div>
          <div style="font-size: 11px; color: #9333EA; font-weight: 600; margin-top: 2px;">Radio: ${baseLocation.radioKm} km</div>
        </div>
      `);
      baseMarker.addTo(markersLayerRef.current);
    }

    // 2. Render Grid Cells (Cuadrículas de Escaneo)
    if (gridCells && gridCells.length > 0) {
      gridCells.forEach((cell, idx) => {
        const cellCircle = L.circle([cell.lat, cell.lon], {
          radius: cell.radio_celda_km * 1000,
          color: '#6B21A8',
          weight: 1,
          fillColor: '#C084FC',
          fillOpacity: 0.08
        });
        cellCircle.bindPopup(`
          <div style="font-family: 'Poppins', sans-serif; color: #1E1B2E; padding: 2px;">
            <div style="font-weight: 700; font-size: 11px; color: #6B21A8;">📐 Celda #${idx + 1}</div>
            <div style="font-size: 10px;">Radio celda: ${cell.radio_celda_km} km</div>
          </div>
        `);
        cellCircle.addTo(markersLayerRef.current!);
      });
    }

    // 3. Render Density Points if provided (Module 1)
    if (densityPoints && densityPoints.length > 0) {
      densityPoints.forEach((point) => {
        const ptLatLng = L.latLng(point.lat, point.lng);
        bounds.extend(ptLatLng);

        const circle = L.circle(ptLatLng, {
          color: '#9333EA',
          fillColor: '#C084FC',
          fillOpacity: 0.35,
          radius: 900
        });

        circle.bindPopup(`
          <div style="font-family: 'Poppins', sans-serif; color: #1E1B2E; padding: 4px;">
            <div style="font-weight: 700; font-size: 13px; color: #6B21A8;">${point.nombre}</div>
            <div style="font-size: 11px; margin-top: 2px;">Giro: <b>${point.categoria}</b></div>
            <div style="font-size: 11px; color: #F59E0B; margin-top: 2px;">★ ${point.calificacion} Calificación prom.</div>
          </div>
        `);
        circle.addTo(markersLayerRef.current!);
      });
    }

    // 4. Render Individual Leads (Module 3)
    if (leads && leads.length > 0) {
      leads.forEach((lead, index) => {
        if (lead.lat && lead.lng) {
          const latLng = L.latLng(lead.lat, lead.lng);
          bounds.extend(latLng);

          const isSelected = selectedLeadId === lead.id;

          const customIcon = L.divIcon({
            className: 'custom-lead-pin',
            html: `
              <div style="
                background: ${isSelected ? '#22C55E' : 'linear-gradient(135deg, #6B21A8, #9333EA)'};
                color: white;
                font-family: 'Poppins', sans-serif;
                font-size: 11px;
                font-weight: 700;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid ${isSelected ? '#FFFFFF' : '#C084FC'};
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                cursor: pointer;
                transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
                transition: transform 0.2s ease;
              ">
                ${index + 1}
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const marker = L.marker([lead.lat, lead.lng], { icon: customIcon });

          marker.bindPopup(`
            <div style="font-family: 'Poppins', sans-serif; color: #1E1B2E; max-width: 220px; padding: 2px;">
              <div style="font-weight: 700; font-size: 13px; color: #6B21A8; margin-bottom: 2px;">${lead.nombre_negocio}</div>
              <div style="font-size: 11px; color: #555; margin-bottom: 4px;">📍 ${lead.direccion_completa}</div>
              <div style="font-size: 11px; font-weight: 600; color: #1E1B2E; margin-bottom: 6px;">📞 ${lead.telefono}</div>
              <div style="display: flex; gap: 4px; margin-top: 4px;">
                <a href="${lead.link_navegacion}" target="_blank" style="
                  background: #9333EA;
                  color: white;
                  font-size: 10px;
                  font-weight: 600;
                  padding: 4px 8px;
                  border-radius: 4px;
                  text-decoration: none;
                ">🧭 Iniciar Ruta</a>
              </div>
            </div>
          `);

          marker.on('click', () => {
            if (onSelectLead) onSelectLead(lead);
          });

          marker.addTo(markersLayerRef.current!);
        }
      });
    }

    if (bounds.isValid() && (leads.length > 1 || densityPoints.length > 1 || (baseLocation && gridCells.length > 0))) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [leads, densityPoints, baseLocation, gridCells, selectedLeadId, onSelectLead]);

  return (
    <div className="w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-[#6B21A8]/50 shadow-inner relative z-0">
      <div ref={mapContainerRef} className="w-full h-full min-h-[340px]" />
    </div>
  );
};

