"use client";

import { useEffect, useMemo, useRef } from "react";

interface Location {
  lat: number;
  lng: number;
  name: string;
  time?: string;
  seq?: number;
}

export interface LeafletMapProps {
  locations: Location[];
  showRoute?: boolean;
  showTraffic?: boolean;
  height?: string;
  activeSegmentStartIndex?: number | null;
  onLocationClick?: (index: number) => void;
  travelMode?: string;
}

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const anyWin = window as any;
  if (anyWin.google?.maps) return Promise.resolve();

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  if (googleMapsScriptPromise) return googleMapsScriptPromise;
  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps-js='true']");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMapsJs = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
  return googleMapsScriptPromise;
}

function googleTravelModeFor(travelMode?: string): google.maps.TravelMode {
  const m = (travelMode || "").toLowerCase();
  if (m.includes("đi bộ") || m.includes("di bo") || m.includes("walk")) return google.maps.TravelMode.WALKING;
  if (m.includes("xe đạp") || m.includes("xe dap") || m.includes("bike") || m.includes("bicycle"))
    return google.maps.TravelMode.BICYCLING;
  if (m.includes("transit") || m.includes("bus") || m.includes("train")) return google.maps.TravelMode.TRANSIT;
  return google.maps.TravelMode.DRIVING;
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

function markerSymbol(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeOpacity: 1,
    strokeWeight: 3,
    scale: 14,
  };
}

function dashedLineIcon(): google.maps.IconSequence {
  return {
    icon: {
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      scale: 4,
    },
    offset: "0",
    repeat: "18px",
  };
}

export default function LeafletMap({
  locations,
  showRoute = true,
  showTraffic = true,
  height = "400px",
  activeSegmentStartIndex = null,
  onLocationClick,
  travelMode,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<{
    markers: google.maps.Marker[];
    polyline: google.maps.Polyline | null;
    directionsRenderer: google.maps.DirectionsRenderer | null;
    trafficLayer: google.maps.TrafficLayer | null;
    infoWindow: google.maps.InfoWindow | null;
  }>({
    markers: [],
    polyline: null,
    directionsRenderer: null,
    trafficLayer: null,
    infoWindow: null,
  });

  const onLocationClickRef = useRef<LeafletMapProps["onLocationClick"]>(onLocationClick);
  useEffect(() => {
    onLocationClickRef.current = onLocationClick;
  }, [onLocationClick]);

  const validLocations = useMemo(
    () =>
      (locations || []).filter(
        (loc) =>
          loc &&
          typeof loc.lat === "number" &&
          typeof loc.lng === "number" &&
          Number.isFinite(loc.lat) &&
          Number.isFinite(loc.lng) &&
          loc.lat !== 0 &&
          loc.lng !== 0
      ),
    [locations]
  );

  const locationsSignature = useMemo(
    () => validLocations.map((loc) => `${Number(loc.lat).toFixed(6)},${Number(loc.lng).toFixed(6)}`).join("|"),
    [validLocations]
  );

  useEffect(() => {
    if (!mapRef.current || validLocations.length === 0) return;
    let cancelled = false;

    const cleanupOverlays = () => {
      const overlays = overlaysRef.current;
      overlays.markers.forEach((m) => m.setMap(null));
      overlays.markers = [];
      if (overlays.polyline) overlays.polyline.setMap(null);
      overlays.polyline = null;
      if (overlays.directionsRenderer) overlays.directionsRenderer.setMap(null);
      overlays.directionsRenderer = null;
      if (overlays.trafficLayer) overlays.trafficLayer.setMap(null);
      overlays.trafficLayer = null;
      overlays.infoWindow = null;
    };

    (async () => {
      try {
        await loadGoogleMapsScript();
        if (cancelled) return;

        const g = (window as any).google as typeof google;

        cleanupOverlays();
        if (mapRef.current) mapRef.current.innerHTML = "";

        // Calculate center
        const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
        const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length;

        const map = new g.maps.Map(mapRef.current as HTMLDivElement, {
          center: { lat: avgLat, lng: avgLng },
          zoom: 13,
          clickableIcons: true,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        mapInstanceRef.current = map;

        if (showTraffic) {
          const traffic = new g.maps.TrafficLayer();
          traffic.setMap(map);
          overlaysRef.current.trafficLayer = traffic;
        }

        const startIndex = typeof activeSegmentStartIndex === "number" ? activeSegmentStartIndex : null;
        const canFocusSegment =
          startIndex !== null && startIndex >= 0 && startIndex < validLocations.length - 1;

        const displayLocations: Array<{ location: Location; originalIndex: number }> = canFocusSegment
          ? [
              { location: validLocations[startIndex], originalIndex: startIndex },
              { location: validLocations[startIndex + 1], originalIndex: startIndex + 1 },
            ]
          : validLocations.map((l, idx) => ({ location: l, originalIndex: idx }));

        const infoWindow = new g.maps.InfoWindow();
        overlaysRef.current.infoWindow = infoWindow;

        // Markers
        displayLocations.forEach(({ location, originalIndex }, index) => {
          const displayNumber = typeof location.seq === "number" ? location.seq : originalIndex + 1;
          const color = getMarkerColor(index, displayLocations.length);

          const marker = new g.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map,
            label: {
              text: String(displayNumber),
              color: "#ffffff",
              fontWeight: "700",
            },
            icon: markerSymbol(color),
            title: location.name,
          });

          marker.addListener("click", () => {
            const handler = onLocationClickRef.current;
            if (handler) handler(originalIndex);

            const safeName = String(location.name || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const safeTime = String(location.time || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const content = `
              <div style="padding: 6px; min-width: 160px;">
                <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">
                  ${displayNumber}. ${safeName}
                </div>
                ${safeTime ? `<div style="font-size: 12px; color: #6b7280;">${safeTime}</div>` : ""}
              </div>
            `;
            infoWindow.setContent(content);
            infoWindow.open({ map, anchor: marker });
          });

          overlaysRef.current.markers.push(marker);
        });

        // Fit bounds
        const boundsLocations = canFocusSegment ? displayLocations.map((d) => d.location) : validLocations;
        if (boundsLocations.length > 1) {
          const bounds = new g.maps.LatLngBounds();
          boundsLocations.forEach((loc) => bounds.extend({ lat: loc.lat, lng: loc.lng }));
          map.fitBounds(bounds, 80);
        } else if (boundsLocations.length === 1) {
          map.setCenter({ lat: boundsLocations[0].lat, lng: boundsLocations[0].lng });
          map.setZoom(14);
        }

        // Route
        if (showRoute && validLocations.length > 1) {
          const coords = (canFocusSegment
            ? [
                { lat: validLocations[startIndex!].lat, lng: validLocations[startIndex!].lng },
                { lat: validLocations[startIndex! + 1].lat, lng: validLocations[startIndex! + 1].lng },
              ]
            : validLocations.map((l) => ({ lat: l.lat, lng: l.lng }))) as Array<{ lat: number; lng: number }>;

          const drawFallback = () => {
            const line = new g.maps.Polyline({
              path: coords,
              geodesic: true,
              strokeColor: "#3b82f6",
              strokeOpacity: 0,
              strokeWeight: 4,
              icons: [dashedLineIcon()],
            });
            line.setMap(map);
            overlaysRef.current.polyline = line;
          };

          // Avoid exceeding Google Directions waypoint limits (23 waypoints + origin + destination)
          if (coords.length > 25) {
            drawFallback();
            return;
          }

          const service = new g.maps.DirectionsService();
          const renderer = new g.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#3b82f6",
              strokeOpacity: 0.85,
              strokeWeight: 4,
            },
          });
          renderer.setMap(map);
          overlaysRef.current.directionsRenderer = renderer;

          const origin = coords[0];
          const destination = coords[coords.length - 1];
          const waypoints = coords.slice(1, -1).map((c) => ({ location: c, stopover: true }));
          const request: google.maps.DirectionsRequest = {
            origin,
            destination,
            waypoints,
            optimizeWaypoints: false,
            travelMode: googleTravelModeFor(travelMode),
          };

          const result = await new Promise<{ res: google.maps.DirectionsResult | null; status: google.maps.DirectionsStatus }>(
            (resolve) => {
              service.route(request, (res, status) => resolve({ res, status }));
            }
          );

          if (cancelled) return;

          if (result.status === g.maps.DirectionsStatus.OK && result.res) {
            renderer.setDirections(result.res);
          } else {
            // Directions may require billing/enabled API; always fall back to a visible line.
            renderer.setMap(null);
            overlaysRef.current.directionsRenderer = null;
            drawFallback();
          }
        }
      } catch (e) {
        // If Google Maps cannot load (missing key / blocked), keep UI stable.
        cleanupOverlays();
        mapInstanceRef.current = null;
        if (mapRef.current) mapRef.current.innerHTML = "";
        console.warn("Google Maps init failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      const overlays = overlaysRef.current;
      overlays.markers.forEach((m) => m.setMap(null));
      overlays.markers = [];
      if (overlays.polyline) overlays.polyline.setMap(null);
      overlays.polyline = null;
      if (overlays.directionsRenderer) overlays.directionsRenderer.setMap(null);
      overlays.directionsRenderer = null;
      if (overlays.trafficLayer) overlays.trafficLayer.setMap(null);
      overlays.trafficLayer = null;
      overlays.infoWindow = null;
      mapInstanceRef.current = null;
    };
  }, [locationsSignature, showRoute, showTraffic, activeSegmentStartIndex, travelMode]);

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

  // If key is missing, show a clear message instead of a blank map.
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <div className="text-center text-gray-600 max-w-md px-4">
          <div className="font-semibold mb-1">Chưa cấu hình Google Maps</div>
          <div className="text-sm">
            Thiếu biến môi trường <span className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-0" style={{ height }}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg shadow-lg overflow-hidden"
        style={{ height: "100%" }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 max-w-[200px] max-h-40 overflow-y-auto z-20">
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
