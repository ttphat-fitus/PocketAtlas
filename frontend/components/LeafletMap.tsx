"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Location {
  lat: number;
  lng: number;
  name: string;
  time?: string;
  seq?: number;
}

interface LeafletMapProps {
  locations: Location[];
  showRoute?: boolean;
  height?: string;
  activeSegmentStartIndex?: number | null;
  onLocationClick?: (index: number) => void;
  travelMode?: string;
}

const OSRM_ROUTE_CACHE = new Map<string, L.LatLngExpression[]>();

function osrmProfileForTravelMode(travelMode?: string): "driving" | "foot" | "bike" {
  const m = (travelMode || "").toLowerCase();

  // Vietnamese
  if (m.includes("đi bộ") || m.includes("di bo") || m.includes("walk")) return "foot";
  if (m.includes("xe đạp") || m.includes("xe dap") || m.includes("bike") || m.includes("bicycle")) return "bike";

  // Default: road driving (includes car/motorbike/taxi)
  return "driving";
}

async function fetchOsrmRoute(
  profile: "driving" | "foot" | "bike",
  coords: Array<{ lat: number; lng: number }>,
  signal: AbortSignal
): Promise<L.LatLngExpression[] | null> {
  if (coords.length < 2) return null;

  const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const cacheKey = `${profile}:${coordStr}`;
  const cached = OSRM_ROUTE_CACHE.get(cacheKey);
  if (cached) return cached;

  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;

  const data = await res.json();
  const coordinates = data?.routes?.[0]?.geometry?.coordinates as
    | Array<[number, number]>
    | undefined;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const routePoints: L.LatLngExpression[] = coordinates.map(([lng, lat]) => [lat, lng]);
  OSRM_ROUTE_CACHE.set(cacheKey, routePoints);
  return routePoints;
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

export default function LeafletMap({
  locations,
  showRoute = true,
  height = "400px",
  activeSegmentStartIndex = null,
  onLocationClick,
  travelMode,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Filter valid locations
  const validLocations = locations.filter(
    (loc) => loc.lat && loc.lng && !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0 && loc.lng !== 0
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

    // Initialize map with better controls
    const map = L.map(mapRef.current, {
      center: [avgLat, avgLng],
      zoom: 13,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add tile layer (OpenStreetMap) with better styling
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 10,
    }).addTo(map);

    // Add scale control for better distance visualization
    L.control.scale({
      position: "bottomright",
      metric: true,
      imperial: false,
      maxWidth: 150,
    }).addTo(map);

    const startIndex = typeof activeSegmentStartIndex === "number" ? activeSegmentStartIndex : null;
    const canFocusSegment =
      startIndex !== null && startIndex >= 0 && startIndex < validLocations.length - 1;

    const displayLocations: Array<{ location: Location; originalIndex: number }> = canFocusSegment
      ? [
          { location: validLocations[startIndex], originalIndex: startIndex },
          { location: validLocations[startIndex + 1], originalIndex: startIndex + 1 },
        ]
      : validLocations.map((l, idx) => ({ location: l, originalIndex: idx }));

    // Add markers
    const markers: L.Marker[] = [];
    displayLocations.forEach(({ location, originalIndex }, index) => {
      const displayNumber = typeof location.seq === "number" ? location.seq : originalIndex + 1;
      const icon = createNumberedIcon(displayNumber, getMarkerColor(index, displayLocations.length));
      
      const marker = L.marker([location.lat, location.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="padding: 4px; min-width: 150px;">
            <div style="font-weight: bold; color: #1e40af; margin-bottom: 4px;">
              ${displayNumber}. ${location.name}
            </div>
            ${location.time ? `<div style="font-size: 12px; color: #6b7280;">${location.time}</div>` : ""}
          </div>
        `);

      marker.on("click", () => {
        if (onLocationClick) onLocationClick(originalIndex);
      });
      
      markers.push(marker);
    });

    // Draw route line with better visibility (optionally focus a single segment)
    if (showRoute && validLocations.length > 1) {
      const fallbackPoints: L.LatLngExpression[] = validLocations.map((loc) => [loc.lat, loc.lng]);

      const controller = new AbortController();
      const profile = osrmProfileForTravelMode(travelMode);

      const drawPolyline = (path: L.LatLngExpression[]) => {
        // Shadow line for depth and visibility
        L.polyline(path, {
          color: "#000000",
          weight: canFocusSegment ? 7 : 6,
          opacity: canFocusSegment ? 0.18 : 0.15,
        }).addTo(map);

        // Main route line
        L.polyline(path, {
          color: "#3b82f6",
          weight: canFocusSegment ? 5 : 4,
          opacity: canFocusSegment ? 0.95 : 0.85,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);
      };

      (async () => {
        try {
          if (canFocusSegment) {
            const segCoords = [
              { lat: validLocations[startIndex].lat, lng: validLocations[startIndex].lng },
              { lat: validLocations[startIndex + 1].lat, lng: validLocations[startIndex + 1].lng },
            ];

            const routed = await fetchOsrmRoute(profile, segCoords, controller.signal);
            drawPolyline(routed || [fallbackPoints[startIndex], fallbackPoints[startIndex + 1]]);
            return;
          }

          const routed = await fetchOsrmRoute(
            profile,
            validLocations.map((l) => ({ lat: l.lat, lng: l.lng })),
            controller.signal
          );
          drawPolyline(routed || fallbackPoints);
        } catch {
          // Fallback: draw straight segments when OSRM is unavailable
          if (canFocusSegment) {
            drawPolyline([fallbackPoints[startIndex], fallbackPoints[startIndex + 1]]);
            return;
          }
          drawPolyline(fallbackPoints);
        }
      })();

      // Ensure OSRM request cancels on cleanup
      map.on("unload", () => controller.abort());
    }

    // Fit bounds with better padding for optimal view
    const boundsLocations = canFocusSegment ? displayLocations.map((d) => d.location) : validLocations;
    if (boundsLocations.length > 1) {
      const bounds = L.latLngBounds(boundsLocations.map((loc) => [loc.lat, loc.lng]));
      
      // Dynamic padding based on number of locations
      const paddingSize = boundsLocations.length <= 3 ? 80 : boundsLocations.length <= 6 ? 60 : 50;
      map.fitBounds(bounds, { 
        padding: [paddingSize, paddingSize],
        maxZoom: 15 // Prevent too much zoom for close locations
      });
    } else if (boundsLocations.length === 1) {
      // Single location - center and set reasonable zoom
      map.setView([boundsLocations[0].lat, boundsLocations[0].lng], 14);
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Map cleanup warning:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [validLocations, showRoute, activeSegmentStartIndex, onLocationClick, travelMode]);

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
          {validLocations.map((loc, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: getMarkerColor(idx, validLocations.length) }}
              >
                {typeof loc.seq === "number" ? loc.seq : idx + 1}
              </span>
              <span className="truncate text-gray-600">{loc.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
