"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import StarRating from "../../components/StarRating";
import { getApiUrl } from "../../lib/api";

interface TripSummary {
  trip_id: string;
  destination: string;
  duration: number;
  budget: string;
  start_date: string;
  created_at: string;
  trip_name: string;
  rating?: number;
  activity_level?: string;
  cover_image?: string;
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Colors for different trips
const TRIP_COLORS = [
  { bg: 'bg-blue-200', border: 'border-blue-500' },
  { bg: 'bg-orange-200', border: 'border-orange-500' },
  { bg: 'bg-purple-200', border: 'border-purple-500' },
  { bg: 'bg-green-200', border: 'border-green-500' },
  { bg: 'bg-pink-200', border: 'border-pink-500' },
  { bg: 'bg-yellow-200', border: 'border-yellow-500' },
];

// Export to Google Calendar
const exportToGoogleCalendar = (trip: TripSummary) => {
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.start_date);
  endDate.setDate(endDate.getDate() + trip.duration);
  
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const title = encodeURIComponent(trip.trip_name || `Trip to ${trip.destination}`);
  const details = encodeURIComponent(`${trip.duration} day trip to ${trip.destination}\\nBudget: ${trip.budget}`);
  const location = encodeURIComponent(trip.destination);
  
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;
  window.open(url, '_blank');
};

// Export to Apple Calendar (iCal format)
const exportToAppleCalendar = (trip: TripSummary) => {
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.start_date);
  endDate.setDate(endDate.getDate() + trip.duration);
  
  const formatICalDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Pocket Atlas//Trip Planner//EN
BEGIN:VEVENT
UID:${trip.trip_id}@pocketatlas.com
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(startDate)}
DTEND:${formatICalDate(endDate)}
SUMMARY:${trip.trip_name || `Trip to ${trip.destination}`}
DESCRIPTION:${trip.duration} day trip to ${trip.destination}\\nBudget: ${trip.budget}
LOCATION:${trip.destination}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${trip.trip_name || trip.destination}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function MyTripsPage() {
  const router = useRouter();
  const { user, loading: authLoading, getIdToken } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }

    if (user) {
      fetchTrips();
    }
  }, [user, authLoading, router]);

  const fetchTrips = async () => {
    try {
      console.log("Starting to fetch trips...");
      console.log("User:", user?.uid);
      console.log("Auth loading:", authLoading);

      const token = await getIdToken();
      console.log("Got token:", token ? token.substring(0, 20) + "..." : "null");
      
      if (!token) {
        throw new Error("No authentication token available. Please log in again.");
      }

      console.log("Fetching trips from Next.js API route");

      const response = await fetch("/api/trips", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch trips (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log("Trips data:", data);
      setTrips(data.trips || []);
    } catch (err) {
      console.error("Full error:", err);
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (tripId: string) => {
    if (!confirm(language === "en" ? "Delete this trip?" : "Xóa chuyến đi này?")) {
      return;
    }

    try {
      const token = await getIdToken();
      const response = await fetch(`/api/trip/${tripId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete trip");
      }

      setTrips(trips.filter((t) => t.trip_id !== tripId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete trip");
    }
  };

  // Generate calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = firstDay.getDay();

    const weeks = [];
    let currentWeek = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Add empty cells to complete last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  // Check if a day has a trip
  const getDayTripInfo = (day: number | null) => {
    if (!day) return null;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const startDate = new Date(trip.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + trip.duration - 1);
      
      if (checkDate >= startDate && checkDate <= endDate) {
        return { 
          tripIndex: i,
          isFirst: checkDate.getTime() === startDate.getTime(),
          isLast: checkDate.getTime() === endDate.getTime()
        };
      }
    }
    return null;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const calendarWeeks = getCalendarDays();
  const monthName = currentMonth.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start">
          <a href="/" className="btn btn-ghost text-xl">
            ← {language === "en" ? "Back" : "Quay lại"}
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            Chuyến đi của tôi
          </a>
        </div>

        <div className="navbar-end">
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            Chuyến đi của tôi
          </h1>
          <a href="/trip/input" className="btn btn-primary">
            {language === "en" ? "+ New Trip" : "+ Tạo chuyến đi mới"}
          </a>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="card bg-white shadow-xl">
            <div className="card-body text-center py-12">
              <p className="text-gray-600">
                {language === "en"
                  ? "No trips yet. Create your first trip!"
                  : "Chưa có chuyến đi nào. Tạo chuyến đi đầu tiên của bạn!"}
              </p>
              <a href="/trip/input" className="btn btn-primary mt-4">
                {language === "en" ? "Plan a Trip" : "Lên kế hoạch"}
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Calendar View */}
            <div className="card bg-white shadow-lg">
              <div className="card-body p-4">
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="btn btn-circle btn-sm btn-ghost"
                  >
                    ←
                  </button>
                  <h2 className="text-lg font-bold capitalize">
                    {monthName}
                  </h2>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="btn btn-circle btn-sm btn-ghost"
                  >
                    →
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="space-y-0.5">
                  {/* Header Row */}
                  <div className="grid grid-cols-8 gap-1 mb-1">
                    <div className="text-center font-semibold text-xs text-gray-600"></div>
                    {(language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']).map((day) => (
                      <div key={day} className="text-center font-semibold text-xs text-gray-600">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Weeks */}
                  {calendarWeeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-8 gap-1">
                      {/* Week label (first column) */}
                      <div className="flex items-center justify-center">
                        {weekIdx === 0 && (
                          <span className="text-xs font-semibold text-gray-700">
                            {currentMonth.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short' })}
                          </span>
                        )}
                      </div>
                      
                      {/* Days */}
                      {week.map((day, dayIdx) => {
                        const tripInfo = getDayTripInfo(day);
                        const colorScheme = tripInfo ? TRIP_COLORS[tripInfo.tripIndex % TRIP_COLORS.length] : null;
                        const isWeekStart = dayIdx === 0;
                        const isWeekEnd = dayIdx === 6;
                        
                        return (
                          <div
                            key={`${weekIdx}-${dayIdx}`}
                            className={`h-8 flex items-center justify-center text-xs font-medium transition-colors
                              ${!day ? '' : tripInfo ? `${colorScheme!.bg} text-gray-800` : 'text-gray-700'}
                              ${tripInfo && (tripInfo.isFirst || isWeekStart) ? 'rounded-l-lg' : ''}
                              ${tripInfo && (tripInfo.isLast || isWeekEnd) ? 'rounded-r-lg' : ''}
                            `}
                          >
                            {day || ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trip Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trips.map((trip, index) => {
                const colorScheme = TRIP_COLORS[index % TRIP_COLORS.length];
                const startDate = new Date(trip.start_date);
                const endDate = new Date(trip.start_date);
                endDate.setDate(endDate.getDate() + trip.duration - 1);

                return (
                  <div key={trip.trip_id} className="card bg-white shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                    {trip.cover_image && (
                      <figure className="h-48 relative">
                        <img
                          src={trip.cover_image}
                          alt={trip.trip_name || trip.destination}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                      </figure>
                    )}
                    <div className="card-body p-6">
                      <div className="text-xs text-gray-400 mb-3">
                        {language === "en" ? `Created: ${formatDate(trip.created_at)}` : `Tạo lúc: ${formatDate(trip.created_at)}`}
                        {!trip.rating && (
                          <>
                            {" • "}
                            {language === "en" ? "Not yet rated" : "Chưa đánh giá"}
                          </>
                        )}
                      </div>
                      
                      {(trip.trip_name && trip.trip_name.trim() !== "") ? (
                        <h3 className="text-xl font-bold mb-4">{trip.trip_name}</h3>
                      ) : (
                        <h3 className="text-xl font-bold mb-4">{trip.destination || "Unknown"}</h3>
                      )}
                      {trip.rating && (
                        <div className="flex items-center gap-2 mb-4">
                          <StarRating rating={Number(trip.rating)} readonly size="sm" />
                          <span className="text-xs text-gray-500">
                            {language === "en" ? "Your rating" : "Đánh giá của bạn"}
                          </span>
                        </div>
                      )}

                      {/* Time, Budget, Activity Info */}
                      <div className="space-y-2 text-sm text-gray-700 mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span><strong>{language === "en" ? "Time:" : "Thời gian:"}</strong> {trip.duration} {language === "en" ? "day" : "ngày"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span><strong>{language === "en" ? "Budget:" : "Ngân sách:"}</strong> {trip.budget === "low" ? (language === "en" ? "Low" : "Thấp") : trip.budget === "medium" ? (language === "en" ? "Medium" : "Trung bình") : (language === "en" ? "High" : "Cao")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span><strong>{language === "en" ? "Activity:" : "Hoạt động:"}</strong> {trip.activity_level === "low" ? (language === "en" ? "Low" : "Thấp") : trip.activity_level === "high" ? (language === "en" ? "High" : "Cao") : (language === "en" ? "Medium" : "Trung bình")}</span>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">{language === "en" ? "Start Date" : "Ngày bắt đầu"}</div>
                            <div className="inline-block px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-100 rounded-full whitespace-nowrap">
                              {formatDate(trip.start_date)}
                            </div>
                          </div>
                          <div className="flex-1 mx-4">
                            <div className="relative">
                              <div className="h-2 bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 rounded-full"></div>
                              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"></div>
                              <div className="absolute top-1/2 right-0 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full"></div>
                            </div>
                            <div className="text-center mt-2">
                              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                {trip.duration} {language === "en" ? "days journey" : "ngày hành trình"}
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">{language === "en" ? "End Date" : "Ngày kết thúc"}</div>
                            <div className="inline-block px-2 py-1 text-[10px] font-bold text-green-700 bg-green-100 rounded-full whitespace-nowrap">
                              {formatDate(endDate.toISOString())}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => deleteTrip(trip.trip_id)}
                          className="btn btn-sm btn-ghost text-error"
                        >
                          {language === "en" ? "Delete" : "Xóa"}
                        </button>
                        <a href={`/trip/${trip.trip_id}`} className="btn btn-sm btn-primary">
                          {language === "en" ? "View" : "Xem"}
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
