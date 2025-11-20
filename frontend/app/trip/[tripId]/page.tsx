"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Format date as dd/mm/yyyy
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Export to Google Calendar
const exportToGoogleCalendar = (tripData: any, tripPlan: any) => {
  const startDate = new Date(tripData.start_date);
  const endDate = new Date(tripData.start_date);
  endDate.setDate(endDate.getDate() + tripData.duration);
  
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const title = encodeURIComponent(tripPlan.trip_name || `Trip to ${tripData.destination}`);
  const details = encodeURIComponent(`${tripData.duration} day trip to ${tripData.destination}\n\n${tripPlan.overview || ''}`);
  const location = encodeURIComponent(tripData.destination);
  
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;
  window.open(url, '_blank');
};

interface PlaceDetails {
  name: string;
  address: string;
  rating: number;
  total_ratings: number;
  photo_url: string;
  lat: number;
  lng: number;
  types?: string[];
}

interface Activity {
  time: string;
  place: string;
  description: string;
  estimated_cost: string;
  tips: string;
  place_details?: PlaceDetails;
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
  destination: string;
  duration: number;
  budget: string;
  start_date: string;
  preferences: string;
  trip_plan: TripPlan;
  created_at: string;
}

// Sortable Activity Item Component
function SortableActivity({ activity, id, language }: { activity: Activity; id: string; language: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-move">
      <div className="card bg-white shadow-md hover:shadow-lg transition-all mb-4">
        <div className="card-body p-4">
          <div className="flex gap-4">
            {activity.place_details?.photo_url && (
              <div className="avatar">
                <div className="w-20 h-20 rounded-lg">
                  <img src={activity.place_details.photo_url} alt={activity.place} />
                </div>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="badge badge-primary badge-sm mb-1">{activity.time}</div>
                  <h4 className="font-bold text-lg">{activity.place}</h4>
                  {activity.place_details?.address && (
                    <p className="text-sm text-gray-500 mt-1">
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {activity.place_details.address}
                    </p>
                  )}
                  {activity.place_details && activity.place_details.rating > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="rating rating-sm">
                        {[...Array(5)].map((_, i) => (
                          <input
                            key={i}
                            type="radio"
                            className="mask mask-star-2 bg-orange-400"
                            checked={i < Math.round(activity.place_details!.rating)}
                            readOnly
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">
                        {activity.place_details.rating.toFixed(1)} ({activity.place_details.total_ratings})
                      </span>
                    </div>
                  )}
                </div>
                <div className="badge badge-success">{activity.estimated_cost}</div>
              </div>
              <p className="text-gray-700 text-sm mb-2">{activity.description}</p>
              {activity.tips && (
                <div className="alert alert-info py-2 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>{activity.tips}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params?.tripId as string;
  const { language, setLanguage, t } = useLanguage();
  const { user, loading: authLoading, getIdToken } = useAuth();
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Fetch trip data
  useEffect(() => {
    const fetchTrip = async () => {
      if (!user || !tripId) return;

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(`http://localhost:8000/api/trip/${tripId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch trip");
        }

        const data = await response.json();
        setTripData(data);
        setTripPlan(data.trip_plan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trip");
      } finally {
        setLoading(false);
      }
    };

    if (user && tripId) {
      fetchTrip();
    }
  }, [user, tripId, getIdToken]);

  const handleDragEnd = (event: DragEndEvent, dayIndex: number) => {
    const { active, over } = event;
    if (!over || !tripPlan) return;

    if (active.id !== over.id) {
      const day = tripPlan.days[dayIndex];
      const oldIndex = day.activities.findIndex((_, idx) => `${dayIndex}-${idx}` === active.id);
      const newIndex = day.activities.findIndex((_, idx) => `${dayIndex}-${idx}` === over.id);

      const newActivities = arrayMove(day.activities, oldIndex, newIndex);
      const newDays = [...tripPlan.days];
      newDays[dayIndex] = { ...day, activities: newActivities };

      setTripPlan({ ...tripPlan, days: newDays });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !tripPlan || !tripData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <span>{error || "Trip not found"}</span>
          <a href="/trips" className="btn btn-sm">
            {language === "en" ? "Back to My Trips" : "Quay lại"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-sm sticky top-0 z-50">
        <div className="navbar-start">
          <a href="/trips" className="btn btn-ghost">
            ← {language === "en" ? "Back" : "Quay lại"}
          </a>
        </div>
        <div className="navbar-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {tripPlan.trip_name}
          </h1>
        </div>
        <div className="navbar-end">
          <div className="flex gap-1 mr-4">
            <button
              onClick={() => setLanguage("en")}
              className={`btn btn-sm ${language === "en" ? "btn-primary" : "btn-ghost"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("vi")}
              className={`btn btn-sm ${language === "vi" ? "btn-primary" : "btn-ghost"}`}
            >
              VI
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-white shadow-xl sticky top-24">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4">{language === "en" ? "Trip Information" : "Thông tin chuyến đi"}</h2>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="badge badge-primary badge-lg">
                    {tripData.destination}
                  </div>
                  <div className="badge badge-secondary badge-lg">
                    {tripData.duration} {language === "en" ? "days" : "ngày"}
                  </div>
                  <div className="badge badge-accent badge-lg">
                    {formatDate(tripData.start_date)}
                  </div>
                </div>

                <div className="stats shadow">
                  <div className="stat p-4">
                    <div className="stat-title text-sm">{language === "en" ? "Total Cost" : "Tổng chi phí"}</div>
                    <div className="stat-value text-xl text-primary">
                      {tripPlan.total_estimated_cost}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => exportToGoogleCalendar(tripData, tripPlan)}
                  className="btn btn-primary btn-sm w-full gap-2 mt-4"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                  </svg>
                  {language === "en" ? "Export to Google Calendar" : "Xuất sang Google Calendar"}
                </button>

                <div className="divider"></div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {language === "en" ? "Packing List" : "Danh sách đồ"}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tripPlan.packing_list.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {language === "en" ? "Travel Tips" : "Mẹo du lịch"}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {tripPlan.travel_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="card bg-white shadow-xl mb-6">
              <div className="card-body">
                <h2 className="card-title text-2xl mb-2">{tripPlan.trip_name}</h2>
                <p className="text-gray-600">{tripPlan.overview}</p>
              </div>
            </div>

            {/* Days Timeline */}
            <div className="space-y-6">
              {tripPlan.days.map((day, dayIndex) => (
                <div key={dayIndex} className="card bg-white shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="badge badge-lg badge-primary px-4 py-3 text-lg font-bold">
                        {language === "en" ? `Day ${day.day}` : `Ngày ${day.day}`}
                      </div>
                      <h3 className="text-xl font-bold">{day.title}</h3>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => handleDragEnd(event, dayIndex)}
                    >
                      <SortableContext
                        items={day.activities.map((_, idx) => `${dayIndex}-${idx}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        {day.activities.map((activity, actIdx) => (
                          <SortableActivity
                            key={`${dayIndex}-${actIdx}`}
                            id={`${dayIndex}-${actIdx}`}
                            activity={activity}
                            language={language}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
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
