"use client";

import { useState, useEffect } from "react";

export default function LandingPage() {
  const destinations: string[] = [
    "Hà Nội",
    "Đà Nẵng",
    "Hội An",
    "Phú Quốc",
    "Đà Lạt",
    "Nha Trang",
  ];

  const [currentDestination, setCurrentDestination] = useState(destinations[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDestination((prev) => {
        const currentIndex = destinations.indexOf(prev);
        const nextIndex = (currentIndex + 1) % destinations.length;
        return destinations[nextIndex];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [destinations]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start" />

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            Pocket Atlas
          </a>
        </div>

        <div className="navbar-end">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a href="/trip/input">Plan Trip</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-6 h-screen place-items-center justify-center px-4">
        <h1 className="text-6xl font-bold w-full text-center">
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-teal-500 to-green-500">
            Pocket Atlas
          </span>
        </h1>

        <h2 className="text-xl w-full text-center text-gray-600 mt-4">
          Your AI-powered travel companion
        </h2>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-gray-500">Plan your perfect trip to</span>
          <div className="badge badge-lg badge-primary font-semibold text-lg px-4 py-3">
            {currentDestination}
          </div>
        </div>

        <h2 className="text-base w-full text-center mt-6 max-w-2xl text-gray-600">
          Discover amazing destinations, create personalized itineraries, and
          explore local attractions with intelligent recommendations powered by
          AI.
        </h2>

        <a href="/trip/input" className="mt-8">
          <button className="btn btn-primary btn-lg rounded-full px-8 text-lg">
            Get Started
          </button>
        </a>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <h3 className="card-title text-lg">Smart Planning</h3>
              <p className="text-sm text-gray-600">
                AI-generated itineraries tailored to your preferences and budget
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">📍</div>
              <h3 className="card-title text-lg">Local Insights</h3>
              <p className="text-sm text-gray-600">
                Discover hidden gems and popular attractions with detailed
                information
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">✨</div>
              <h3 className="card-title text-lg">Personalized</h3>
              <p className="text-sm text-gray-600">
                Customize your trip plan interactively and make it uniquely
                yours
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
