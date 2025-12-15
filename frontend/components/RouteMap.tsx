"use client";

import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./LeafletMap";

interface Location {
  lat: number;
  lng: number;
  name: string;
  time?: string;
  seq?: number;
}

interface RouteMapProps {
  locations: Location[];
  showRoute?: boolean;
  showTraffic?: boolean;
  height?: string;
  activeSegmentStartIndex?: number | null;
  onLocationClick?: (index: number) => void;
  travelMode?: string;
}

// Dynamically import LeafletMap (client-side only, no SSR)
const LeafletMap = dynamic<LeafletMapProps>(() => import("./LeafletMap"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg animate-pulse h-full min-h-[400px]">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  )
});

export default function RouteMap({
  locations,
  showRoute = true,
  showTraffic = true,
  height = "400px",
  activeSegmentStartIndex = null,
  onLocationClick,
  travelMode,
}: RouteMapProps) {
  return (
    <LeafletMap 
      locations={locations} 
      showRoute={showRoute} 
      showTraffic={showTraffic}
      height={height} 
      activeSegmentStartIndex={activeSegmentStartIndex}
      onLocationClick={onLocationClick}
      travelMode={travelMode}
    />
  );
}
