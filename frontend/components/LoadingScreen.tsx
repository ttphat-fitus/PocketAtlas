"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import Image from "next/image";

interface LoadingScreenProps {
  progress: number;
}

export default function LoadingScreen({ progress }: LoadingScreenProps) {
  const [planeRotation, setPlaneRotation] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaneRotation((prev) => (prev + 1.5) % 360);
    }, 30);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-teal-900 z-50 flex items-center justify-center">
      <div className="text-center">
        {/* Image-based 3D Earth and Plane */}
        <div className="relative mb-8 w-[350px] h-[350px] mx-auto">
          {/* Earth Globe - Stationary */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              <Image
                src="/globe.png"
                alt="Earth"
                width={256}
                height={256}
                className="drop-shadow-2xl"
                priority
              />
              {/* Glow effect */}
              <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-3xl"></div>
            </div>
          </div>
          
          {/* Vietnam Airlines Plane orbiting around Earth - Minimal Distance */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `rotate(${planeRotation}deg)`
            }}
          >
            <div 
              className="absolute"
              style={{
                top: '-20px',
                left: '50%',
                transform: `translateX(-50%)`,
              }}
            >
              <Image
                src="/plane.png"
                alt="Vietnam Airlines"
                width={70}
                height={70}
                className="drop-shadow-lg"
                priority
              />
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-80 mx-auto mb-6">
          <div className="bg-blue-900/50 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-teal-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Loading text */}
        <div className="text-white text-xl font-medium">
          {progress < 30 && (t("loading.analyzing") || "Analyzing your preferences...")}
          {progress >= 30 && progress < 60 && (t("loading.searching") || "Searching best destinations...")}
          {progress >= 60 && progress < 90 && (t("loading.planning") || "Planning your itinerary...")}
          {progress >= 90 && (t("loading.finalizing") || "Finalizing your trip...")}
        </div>

        {/* Subtext */}
        <div className="text-blue-200 text-sm mt-2">
          {t("loading.subtitle") || "Creating your perfect journey"}
        </div>
      </div>
    </div>
  );
}
