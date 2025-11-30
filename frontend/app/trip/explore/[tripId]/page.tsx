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

        // Fetch full trip details
        const detailResponse = await fetch(
          `http://localhost:8000/api/trip/${tripId}`,
          {
            headers: {
              "X-User-Id": userId,
            },
          }
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
          <h1 className="text-xl font-bold">{tripPlan.trip_name}</h1>
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
                  {tripData.views_count} {t("views")} • {tripData.likes_count} {t("likes")}
                </p>
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-4">{tripPlan.trip_name}</h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="badge badge-lg bg-pink-100 text-pink-700 border-pink-300">
                📅 {tripData.duration} {language === "en" ? "days" : "ngày"}
              </div>
              <div className="badge badge-lg bg-green-100 text-green-700 border-green-300">
                💰 {tripData.budget}
              </div>
              {tripData.category_tags.map((tag, idx) => (
                <div key={idx} className="badge badge-outline">
                  {tag}
                </div>
              ))}
            </div>

            <p className="text-gray-600">{tripPlan.overview}</p>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="tabs tabs-boxed bg-white shadow-md mb-6 p-2 overflow-x-auto">
          {tripPlan.days.map((day) => (
            <a
              key={day.day}
              className={`tab ${selectedDay === day.day ? "tab-active" : ""}`}
              onClick={() => setSelectedDay(day.day)}
            >
              {language === "en" ? `Day ${day.day}` : `Ngày ${day.day}`}
            </a>
          ))}
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
                        <h3 className="font-bold text-lg">{activity.place}</h3>
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
