"use client";

import dynamic from "next/dynamic";

interface Location {
  lat: number;
  lng: number;
  name: string;
  time?: string;
}

interface RouteMapProps {
  locations: Location[];
  showRoute?: boolean;
  height?: string;
}

// Dynamically import LeafletMap (client-side only, no SSR)
const LeafletMap = dynamic(() => import("./LeafletMap"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg animate-pulse h-full min-h-[400px]">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  )
});

export default function RouteMap({ locations, showRoute = true, height = "400px" }: RouteMapProps) {
  return (
    <LeafletMap 
      locations={locations} 
      showRoute={showRoute} 
      height={height} 
    />
  );
}
