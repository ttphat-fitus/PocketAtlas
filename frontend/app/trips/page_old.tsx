"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

interface TripSummary {
  trip_id: string;
  destination: string;
  duration: number;
  budget: string;
  start_date: string;
  created_at: string;
  trip_name: string;
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Get end date from start date and duration
const getEndDate = (startDate: string, duration: number): string => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + duration - 1);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Colors for different trips
const TRIP_COLORS = [
  { bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-800' },
  { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-800' },
  { bg: 'bg-purple-200', border: 'border-purple-400', text: 'text-purple-800' },
  { bg: 'bg-green-200', border: 'border-green-400', text: 'text-green-800' },
  { bg: 'bg-pink-200', border: 'border-pink-400', text: 'text-pink-800' },
  { bg: 'bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-800' },
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
  const details = encodeURIComponent(`${trip.duration} day trip to ${trip.destination}\nBudget: ${trip.budget}`);
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
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);

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
      const token = await getIdToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/api/my-trips", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      setTrips(data.trips || []);
    } catch (err) {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/trip/${tripId}`, {
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start">
          <a href="/" className="btn btn-ghost text-xl">
            {t("plan.back")}
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {language === "en" ? "My Trips" : "Chuyến đi của tôi"}
          </a>
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

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            {language === "en" ? "My Trips" : "Chuyến đi của tôi"}
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
          <div className="grid grid-cols-1 gap-6">
            {trips.map((trip) => (
              <div key={trip.trip_id} className="card bg-white shadow-xl hover:shadow-2xl transition-shadow">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="card-title text-xl mb-2">{trip.trip_name || trip.destination}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span><strong>{language === "en" ? "Destination:" : "Điểm đến:"}</strong> {trip.destination}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span><strong>{language === "en" ? "Duration:" : "Thời gian:"}</strong> {trip.duration} {t("input.days")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span><strong>{language === "en" ? "Budget:" : "Ngân sách:"}</strong> {trip.budget === "low" ? (language === "en" ? "Low" : "Thấp") : trip.budget === "medium" ? (language === "en" ? "Medium" : "Trung bình") : (language === "en" ? "High" : "Cao")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {language === "en" ? "Created:" : "Tạo lúc:"} {formatDate(trip.created_at)}
                    </div>
                  </div>

                  {/* Timeline Visualization */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{language === "en" ? "Start Date" : "Ngày bắt đầu"}</div>
                        <div className="badge badge-primary badge-lg font-semibold">{formatDate(trip.start_date)}</div>
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="relative">
                          <div className="h-2 bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 rounded-full"></div>
                          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"></div>
                          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow"></div>
                        </div>
                        <div className="text-center mt-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {trip.duration} {language === "en" ? "days journey" : "ngày hành trình"}
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{language === "en" ? "End Date" : "Ngày kết thúc"}</div>
                        <div className="badge badge-success badge-lg font-semibold">{getEndDate(trip.start_date, trip.duration)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <button
                      onClick={() => deleteTrip(trip.trip_id)}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      {language === "en" ? "Delete" : "Xóa"}
                    </button>
                    <a href={`/trip/${trip.trip_id}`} className="btn btn-primary btn-sm">
                      {language === "en" ? "View Details" : "Xem chi tiết"}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
