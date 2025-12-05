"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Location {
  lat: number;
  lng: number;
  name: string;
  time?: string;
}

interface LeafletMapProps {
  locations: Location[];
  showRoute?: boolean;
  height?: string;
}

// Get gradient color based on position
const getMarkerColor = (index: number, total: number): string => {
  const colors = [
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#a855f7", // purple
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#f43f5e", // rose
    "#ef4444", // red
  ];
  const colorIndex = Math.floor((index / Math.max(total - 1, 1)) * (colors.length - 1));
  return colors[colorIndex];
};

// Create custom numbered marker icon
const createNumberedIcon = (number: number, color: string): L.DivIcon => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export default function LeafletMap({ locations, showRoute = true, height = "400px" }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Filter valid locations
  const validLocations = locations.filter(
    loc => loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0 && loc.lng !== 0
  );

  useEffect(() => {
    if (!mapRef.current || validLocations.length === 0) return;

    // Clean up previous map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Calculate center
    const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
    const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [avgLat, avgLng],
      zoom: 13,
      scrollWheelZoom: true,
    });

    mapInstanceRef.current = map;

    // Add tile layer (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add markers
    const markers: L.Marker[] = [];
    validLocations.forEach((location, index) => {
      const icon = createNumberedIcon(index + 1, getMarkerColor(index, validLocations.length));
      
      const marker = L.marker([location.lat, location.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="padding: 4px; min-width: 150px;">
            <div style="font-weight: bold; color: #1e40af; margin-bottom: 4px;">
              ${index + 1}. ${location.name}
            </div>
            ${location.time ? `<div style="font-size: 12px; color: #6b7280;">${location.time}</div>` : ""}
          </div>
        `);
      
      markers.push(marker);
    });

    // Draw route line
    if (showRoute && validLocations.length > 1) {
      const points: L.LatLngExpression[] = validLocations.map(loc => [loc.lat, loc.lng]);
      
      // Dashed line
      L.polyline(points, {
        color: "#3b82f6",
        weight: 3,
        opacity: 0.7,
        dashArray: "10, 10",
      }).addTo(map);
    }

    // Fit bounds
    if (validLocations.length > 1) {
      const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [validLocations, showRoute]);

  // No valid locations
  if (validLocations.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Chưa có tọa độ địa điểm</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg shadow-lg overflow-hidden"
        style={{ height: "100%" }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 max-w-[200px] max-h-40 overflow-y-auto z-[1000]">
        <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Lộ trình
        </div>
        <div className="space-y-1">
          {validLocations.slice(0, 6).map((loc, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: getMarkerColor(idx, validLocations.length) }}
              >
                {idx + 1}
              </span>
              <span className="truncate text-gray-600">{loc.name}</span>
            </div>
          ))}
          {validLocations.length > 6 && (
            <div className="text-xs text-gray-400 italic">
              +{validLocations.length - 6} địa điểm khác...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
