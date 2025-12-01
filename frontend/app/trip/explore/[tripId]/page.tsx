"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useLanguage } from "../../../../contexts/LanguageContext";

interface Activity {
  time: string;
  place: string;
  description: string;
  estimated_cost: string;
  place_details?: {
    name: string;
    address: string;
    rating: number;
    photo_url: string;
    google_maps_link?: string;
  };
}

interface Day {
  day: number;
  title: string;
  activities: Activity[];
}

interface TripPlan {
  trip_name: string;
  overview: string;
  total_estimated_cost: string;
  days: Day[];
  packing_list: string[];
  travel_tips: string[];
}

interface TripData {
  trip_id: string;
  user_id: string;
  destination: string;
  duration: number;
  budget: string;
  start_date: string;
  trip_plan: TripPlan;
  is_public: boolean;
  views_count: number;
  likes_count: number;
  category_tags: string[];
  username?: string;
  activity_level?: string;
}

export default function ExploreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  
  const tripId = params.tripId as string;
  const userId = searchParams.get("userId");
  
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    const fetchTrip = async () => {
      if (!tripId || !userId) return;

      try {
        setLoading(true);
        
        // Fetch public trip data
        const response = await fetch(
          `http://localhost:8000/api/catalog/trips?page=1&limit=100`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch trip");
        }

        const data = await response.json();
        const trip = data.trips.find((t: any) => t.trip_id === tripId);
        
        if (!trip) {
          throw new Error("Trip not found");
        }

        // Fetch full trip details using public endpoint
        const detailResponse = await fetch(
          `http://localhost:8000/api/public-trip/${tripId}`
        );

        if (detailResponse.ok) {
          const fullData = await detailResponse.json();
          setTripData(fullData);
          setTripPlan(fullData.trip_plan);
        } else {
          // Fallback to catalog data
          setTripData(trip as any);
          setTripPlan(trip.trip_plan);
        }

        // Increment view count
        await fetch(`http://localhost:8000/api/trip/${tripId}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId || "anonymous" }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trip");
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [tripId, userId]);

  const handleLike = async () => {
    if (!tripId || !userId) return;

    try {
      const response = await fetch(`http://localhost:8000/api/trip/${tripId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId || "anonymous" }),
      });

      if (response.ok) {
        setLiked(!liked);
        const data = await response.json();
        if (tripData) {
          setTripData({ ...tripData, likes_count: data.likes_count });
        }
      }
    } catch (err) {
      console.error("Failed to like trip:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !tripPlan || !tripData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error || "Trip not found"}</span>
        </div>
      </div>
    );
  }

  const currentDay = tripPlan.days.find((d) => d.day === selectedDay) || tripPlan.days[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-md sticky top-0 z-50">
        <div className="navbar-start">
          <button onClick={() => router.back()} className="btn btn-ghost">
            ← {language === "en" ? "Back" : "Quay lại"}
          </button>
        </div>
        <div className="navbar-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600">
            {tripPlan.trip_name}
          </h1>
        </div>
        <div className="navbar-end">
          <button
            onClick={handleLike}
            className={`btn btn-circle ${liked ? "btn-error" : "btn-ghost"}`}
          >
            <svg className="w-6 h-6" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cover Image */}
      {tripData.cover_image && (
        <div className="relative h-64 md:h-96 w-full">
          <img
            src={tripData.cover_image}
            alt={tripPlan.trip_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>
      )}

      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="card bg-white shadow-xl mb-6">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-4">
              <div className="avatar placeholder">
                <div className="bg-primary text-white w-10 h-10 rounded-full">
                  {(tripData.username || "A").charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <p className="font-semibold">{tripData.username || "Anonymous"}</p>
                <p className="text-xs text-gray-500">
                  {tripData.views_count > 0 && `${tripData.views_count} ${t("views")}`}
                  {tripData.views_count > 0 && tripData.likes_count > 0 && " • "}
                  {tripData.likes_count > 0 && `${tripData.likes_count} ${t("likes")}`}
                  {tripData.views_count === 0 && tripData.likes_count === 0 && (language === "en" ? "New trip" : "Chuyến mới")}
                </p>
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-4">{tripPlan.trip_name}</h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="badge badge-lg bg-pink-100 text-pink-700 border-pink-300 gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {tripData.duration} {language === "en" ? "days" : "ngày"}
              </div>
              <div className="badge badge-lg bg-green-100 text-green-700 border-green-300 gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {tripData.budget === "low" ? (language === "en" ? "Low" : "Thấp") : tripData.budget === "medium" ? (language === "en" ? "Medium" : "Trung bình") : (language === "en" ? "High" : "Cao")}
              </div>
              <div className="badge badge-lg bg-purple-100 text-purple-700 border-purple-300 gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {tripData.activity_level === "low" ? (language === "en" ? "Low" : "Thấp") : tripData.activity_level === "high" ? (language === "en" ? "High" : "Cao") : (language === "en" ? "Medium" : "Trung bình")}
              </div>
              {tripData.category_tags.map((tag, idx) => (
                <div key={idx} className="badge badge-outline">
                  {t(tag) || tag}
                </div>
              ))}
            </div>

            <p className="text-gray-600">{tripPlan.overview}</p>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg rounded-2xl p-4 mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {tripPlan.days.map((day) => (
              <button
                key={day.day}
                className={`relative px-8 py-4 font-bold text-lg transition-all duration-300 whitespace-nowrap ${
                  selectedDay === day.day
                    ? "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-2xl rounded-2xl"
                    : "bg-white text-gray-600 hover:bg-gray-50 hover:shadow-md border border-gray-200 rounded-xl"
                }`}
                onClick={() => setSelectedDay(day.day)}
              >
                {selectedDay === day.day && (
                  <span className="absolute inset-0 rounded-2xl bg-white opacity-20 animate-pulse"></span>
                )}
                <span className="relative z-10">
                  {language === "en" ? `Day ${day.day}` : `Ngày ${day.day}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Day Content */}
        <div className="card bg-white shadow-xl">
          <div className="card-body">
            <h2 className="text-2xl font-bold mb-6">{currentDay.title}</h2>

            <div className="space-y-4">
              {currentDay.activities.map((activity, idx) => (
                <div key={idx} className="card bg-base-100 border border-gray-200">
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="badge badge-primary mb-2">{activity.time}</div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{activity.place}</h3>
                          {activity.place_details?.google_maps_link && (
                            <a
                              href={activity.place_details.google_maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-xs text-blue-600 hover:text-blue-800"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <p className="text-gray-600 mt-2">{activity.description}</p>
                        <p className="text-sm text-green-600 font-semibold mt-2">
                          {activity.estimated_cost}
                        </p>
                      </div>
                      {activity.place_details?.photo_url && (
                        <img
                          src={activity.place_details.photo_url}
                          alt={activity.place}
                          className="w-32 h-32 object-cover rounded-lg ml-4"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
