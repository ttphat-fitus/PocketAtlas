"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import StarRating from "../../../components/StarRating";
import dynamic from "next/dynamic";

// Dynamic import for RouteMap to avoid SSR issues
const RouteMap = dynamic(() => import("../../../components/RouteMap"), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>,
});

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

// Format price display
const formatPrice = (price: string): string => {
  if (!price || price === '0đ' || price === '0 đ' || price.toLowerCase() === 'free') {
    return 'Miễn phí';
  }
  return price;
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

// Export to Apple Calendar (.ics file)
const exportToAppleCalendar = (tripData: any, tripPlan: any) => {
  const startDate = new Date(tripData.start_date);
  const endDate = new Date(tripData.start_date);
  endDate.setDate(endDate.getDate() + tripData.duration);
  
  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  // Build detailed description with daily itinerary
  let description = `${tripPlan.overview}\\n\\n`;
  tripPlan.days.forEach((day: any) => {
    description += `Day ${day.day}: ${day.title}\\n`;
    day.activities.forEach((activity: any) => {
      description += `- ${activity.time}: ${activity.place}\\n`;
    });
    description += `\\n`;
  });
  
  // Create ICS file content
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pocket Atlas//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${tripPlan.trip_name || `Trip to ${tripData.destination}`}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${tripData.destination}`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:0`,
    `UID:${tripData.trip_id}@pocketatlas.com`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  // Create blob and download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${tripPlan.trip_name || tripData.destination}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
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
  google_maps_link?: string;
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

interface WeatherForecast {
  day: number;
  date: string;
  condition: string;
  temp_max: number;
  temp_min: number;
  rain_chance: number;
  humidity: number;
  suggestion: string;
}

interface TripPlan {
  trip_name: string;
  overview: string;
  total_estimated_cost: string;
  days: Day[];
  packing_list: string[];
  travel_tips: string[];
  weather_forecast?: WeatherForecast[];
  cover_image?: string;
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
  activity_level?: string;
  is_public?: boolean;
  category_tags?: string[];
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
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg">{activity.place}</h4>
                    {activity.place_details?.google_maps_link && (
                      <a
                        href={activity.place_details.google_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-circle btn-xs btn-ghost text-blue-600 hover:bg-blue-100 hover:text-blue-800"
                        title="Mở trong Google Maps"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                      </a>
                    )}
                  </div>
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
                <div className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full whitespace-nowrap">{formatPrice(activity.estimated_cost)}</div>
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
  const [rating, setRating] = useState(0);
  const [ratingUpdating, setRatingUpdating] = useState(false);
  const [showCoverImageModal, setShowCoverImageModal] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageUpdating, setCoverImageUpdating] = useState(false);
  const [coverImageLoaded, setCoverImageLoaded] = useState(false);

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
        console.log("Trip data fetched:", data);
        
        // Extract cover image from either location
        const coverImage = data.trip_plan?.cover_image || data.cover_image || "";
        console.log("Cover image URL:", coverImage);
        console.log("Trip plan structure:", data.trip_plan);
        
        setTripData(data);
        // Ensure tripPlan has cover_image
        const planWithCover = { ...data.trip_plan, cover_image: coverImage };
        setTripPlan(planWithCover);
        setRating(data.rating || 0);
        setCoverImageUrl(coverImage);
        setCoverImageLoaded(false);
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

  const handleRatingChange = async (newRating: number) => {
    if (!user || !tripId || ratingUpdating) return;

    setRatingUpdating(true);
    const oldRating = rating;
    setRating(newRating);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`http://localhost:8000/api/trip/${tripId}/rating`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating: newRating }),
      });

      if (!response.ok) {
        throw new Error("Failed to update rating");
      }
    } catch (err) {
      // Revert rating on error
      setRating(oldRating);
      console.error("Failed to update rating:", err);
    } finally {
      setRatingUpdating(false);
    }
  };

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

  const handleUpdateCoverImage = async () => {
    if (!user || !tripId || !tripPlan || !coverImageUrl) return;

    setCoverImageUpdating(true);

    try {
      const token = await getIdToken();
      const response = await fetch(`http://localhost:8000/api/trip/${tripId}/cover-image`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cover_image: coverImageUrl }),
      });

      if (response.ok) {
        const updatedTripPlan = { ...tripPlan, cover_image: coverImageUrl };
        setTripPlan(updatedTripPlan);
        setCoverImageLoaded(false);
        setShowCoverImageModal(false);
        // Show success toast
        alert(language === "en" ? "Cover image updated successfully!" : "Ảnh bìa đã được cập nhật!");
      } else {
        throw new Error("Failed to update cover image");
      }
    } catch (err) {
      console.error("Failed to update cover image:", err);
      alert(language === "en" ? "Failed to update cover image. Please try again." : "Không thể cập nhật ảnh bìa. Vui lòng thử lại.");
    } finally {
      setCoverImageUpdating(false);
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
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header with title and metadata */}
        <div className="card bg-white shadow-xl mb-6">
          <div className="card-body">
            {/* Cover Image */}
            <div className="relative h-64 w-full rounded-xl overflow-hidden mb-6 -mx-8 -mt-8 group bg-gradient-to-r from-blue-400 via-teal-400 to-green-400">
              {tripPlan?.cover_image && (
                <>
                  <img
                    key={tripPlan.cover_image}
                    src={tripPlan.cover_image}
                    alt={tripPlan.trip_name}
                    className="w-full h-full object-cover transition-opacity duration-500"
                    onLoad={() => {
                      console.log("✓ Cover image loaded successfully:", tripPlan.cover_image);
                      setCoverImageLoaded(true);
                    }}
                    onError={(e) => {
                      console.error("✗ Cover image failed to load:", tripPlan.cover_image, e);
                      setCoverImageLoaded(false);
                    }}
                  />
                  {coverImageLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  )}
                </>
              )}
              {!tripPlan?.cover_image && (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {!coverImageLoaded && tripPlan?.cover_image && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              )}
              <button
                onClick={() => setShowCoverImageModal(true)}
                className="absolute top-4 right-4 btn btn-sm btn-circle bg-white/80 hover:bg-white border-none shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            
            <div className="text-xs text-gray-400 mb-2">
              {language === "en" ? `Created: ${formatDate(tripData.created_at)}` : `Tạo lúc: ${formatDate(tripData.created_at)}`}
              {" • "}
              {(!rating || rating === 0) ? (
                language === "en" ? "Not yet rated" : "Chưa đánh giá"
              ) : (
                <span className="text-yellow-500 font-semibold">{language === "en" ? "Rated" : "Đã đánh giá"}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-4">{tripPlan.trip_name}</h1>
            
            {/* Trip Metadata - Time, Budget, Activity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs text-gray-500">{language === "en" ? "Time" : "Thời gian"}</div>
                  <div className="font-semibold text-gray-800">{tripData.duration} {language === "en" ? "day" : "ngày"}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs text-gray-500">{language === "en" ? "Budget" : "Ngân sách"}</div>
                  <div className="font-semibold text-gray-800 capitalize">{tripData.budget}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs text-gray-500">{language === "en" ? "Activity" : "Hoạt động"}</div>
                  <div className="font-semibold text-gray-800 capitalize">
                    {tripData.activity_level === "low" ? (language === "en" ? "Low" : "Thấp") : tripData.activity_level === "high" ? (language === "en" ? "High" : "Cao") : (language === "en" ? "Medium" : "Trung bình")}
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600">{tripPlan.overview}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-white shadow-xl sticky top-24">
              <div className="card-body p-6">
                <h2 className="card-title text-xl mb-6 text-center w-full">
                  {language === "en" ? "Trip Information" : "Thông tin chuyến đi"}
                </h2>
                
                {/* Rating Section - Moved to Top */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg mb-6">
                  <h3 className="font-bold mb-3 flex items-center justify-center gap-2 text-gray-700">
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {language === "en" ? "Rate this trip" : "Đánh giá chuyến đi"}
                  </h3>
                  <div className="flex flex-col items-center gap-2">
                    <StarRating
                      rating={rating}
                      onRatingChange={handleRatingChange}
                      size="lg"
                    />
                    {ratingUpdating && (
                      <span className="text-xs text-gray-500">
                        {language === "en" ? "Saving..." : "Đang lưu..."}
                      </span>
                    )}
                  </div>
                </div>

                {/* Trip Details */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">{language === "en" ? "Start Date" : "Ngày bắt đầu"}</div>
                      <div className="font-semibold text-gray-800">{formatDate(tripData.start_date)}</div>
                    </div>
                  </div>
                </div>

                {/* Total Cost - Vertical stacked layout */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 mb-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm text-indigo-600 font-semibold">{language === "en" ? "Total Cost" : "Tổng chi phí"}</span>
                  </div>
                  <div className="font-bold text-indigo-700">
                    {tripPlan?.total_estimated_cost?.replace(/VND/g, '₫').replace(/đ/g, '₫') || '0 ₫'}
                  </div>
                </div>

                {/* Export Button */}
                {/* Export Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => exportToGoogleCalendar(tripData, tripPlan)}
                    className="btn btn-primary w-full gap-2 shadow-md hover:shadow-lg transition-all text-sm whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                    </svg>
                    <span className="truncate">{language === "en" ? "Google Calendar" : "Google Calendar"}</span>
                  </button>
                  
                  <button
                    onClick={() => exportToAppleCalendar(tripData, tripPlan)}
                    className="btn btn-outline btn-primary w-full gap-2 shadow-md hover:shadow-lg transition-all text-sm whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span className="truncate">{language === "en" ? "Apple Calendar" : "Apple Calendar"}</span>
                  </button>
                  
                  {/* Toggle Public/Private Button */}
                  <button
                    onClick={async () => {
                      if (!user || !tripId) return;
                      
                      const newIsPublic = !tripData.is_public;
                      
                      try {
                        const token = await getIdToken();
                        const response = await fetch(`http://localhost:8000/api/trip/${tripId}/toggle-public`, {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            is_public: newIsPublic,
                            category_tags: tripData.category_tags || [],
                          }),
                        });
                        
                        if (response.ok) {
                          setTripData({ ...tripData, is_public: newIsPublic });
                        }
                      } catch (err) {
                        console.error("Failed to toggle public status:", err);
                      }
                    }}
                    className={`btn w-full gap-2 shadow-md hover:shadow-lg transition-all text-sm ${
                      tripData.is_public ? "btn-success" : "btn-outline"
                    }`}
                  >
                    {tripData.is_public ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{language === "en" ? "Public" : "Đã công khai"}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>{language === "en" ? "Make Public" : "Công khai"}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="divider my-6"></div>

                {/* Weather Forecast Section */}
                {tripPlan.weather_forecast && tripPlan.weather_forecast.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6c0 4.314 6 10 6 10s6-5.686 6-10a6 6 0 00-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
                      </svg>
                      {language === "en" ? "Weather Forecast" : "Dự báo thời tiết"}
                    </h3>
                    <div className="space-y-2">
                      {tripPlan.weather_forecast?.map((weather, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-sm font-semibold text-gray-700">
                              {language === "en" ? `Day ${weather.day}` : `Ngày ${weather.day}`}
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                              {weather.temp_max}° / {weather.temp_min}°C
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 mb-1">{weather.condition}</div>
                          <div className="flex gap-3 text-xs text-gray-600">
                            <span>☔ {weather.rain_chance}%</span>
                            <span>💧 {weather.humidity}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {language === "en" ? "Packing List" : "Danh sách đồ"}
                    </h3>
                    {(() => {
                      const packingList = tripPlan.packing_list;
                      if (!packingList) {
                        return <p className="text-sm text-gray-500 italic">Chưa có danh sách đồ dùng</p>;
                      }
                      // Handle if it's a string (parse it)
                      const items = Array.isArray(packingList) ? packingList : [];
                      const validItems = items.filter(item => typeof item === 'string' && item.trim());
                      
                      if (validItems.length === 0) {
                        return <p className="text-sm text-gray-500 italic">Chưa có danh sách đồ dùng</p>;
                      }
                      
                      return (
                        <ul className="space-y-1 text-sm">
                          {validItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>

                  <div>
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {language === "en" ? "Travel Tips" : "Mẹo du lịch"}
                    </h3>
                    {(() => {
                      const travelTips = tripPlan.travel_tips;
                      if (!travelTips) {
                        return <p className="text-sm text-gray-500 italic">Chưa có mẹo du lịch</p>;
                      }
                      // Handle if it's a string (parse it)
                      const tips = Array.isArray(travelTips) ? travelTips : [];
                      const validTips = tips.filter(tip => typeof tip === 'string' && tip.trim());
                      
                      if (validTips.length === 0) {
                        return <p className="text-sm text-gray-500 italic">Chưa có mẹo du lịch</p>;
                      }
                      
                      return (
                        <ul className="space-y-1 text-sm">
                          {validTips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Days Timeline */}
            <div className="space-y-6">
              {tripPlan.days?.map((day, dayIndex) => (
                <div key={dayIndex} className="card bg-white shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="badge badge-lg badge-primary px-4 py-3 text-lg font-bold">
                        {language === "en" ? `Day ${day.day}` : `Ngày ${day.day}`}
                      </div>
                      <h3 className="text-xl font-bold">{day.title}</h3>
                    </div>

                    {/* Route Map for this day */}
                    {day.activities.some(a => a.place_details?.lat && a.place_details?.lng) && (
                      <div className="mb-4">
                        <RouteMap
                          locations={day.activities
                            .filter(a => a.place_details?.lat && a.place_details?.lng)
                            .map(a => ({
                              lat: a.place_details!.lat,
                              lng: a.place_details!.lng,
                              name: a.place,
                              time: a.time,
                            }))}
                          height="250px"
                        />
                      </div>
                    )}

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => handleDragEnd(event, dayIndex)}
                    >
                      <SortableContext
                        items={day.activities?.map((_, idx) => `${dayIndex}-${idx}`) || []}
                        strategy={verticalListSortingStrategy}
                      >
                        {day.activities?.map((activity, actIdx) => (
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

      {/* Cover Image Modal */}
      {showCoverImageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-pop-in">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {language === "en" ? "Update Cover Image" : "Cập nhật ảnh bìa"}
            </h3>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">{language === "en" ? "Image URL" : "URL hình ảnh"}</span>
              </label>
              <input
                type="url"
                placeholder="https://..."
                className="input input-bordered w-full"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                disabled={coverImageUpdating}
              />
            </div>

            {coverImageUrl && (
              <div className="mb-4 rounded-lg overflow-hidden h-40 bg-gray-100">
                <img
                  src={coverImageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x200?text=Invalid+URL";
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCoverImageModal(false);
                  setCoverImageUrl(tripPlan?.cover_image || "");
                }}
                className="btn btn-ghost"
                disabled={coverImageUpdating}
              >
                {language === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                onClick={handleUpdateCoverImage}
                disabled={!coverImageUrl || coverImageUpdating}
                className="btn btn-primary"
              >
                {coverImageUpdating ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    {language === "en" ? "Saving..." : "Đang lưu..."}
                  </>
                ) : (
                  language === "en" ? "Save" : "Lưu"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
