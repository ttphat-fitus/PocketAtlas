"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import RouteMap from "../../../components/RouteMap";

// Format date as dd/mm/yyyy
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Format price display - always show "Miễn phí" for free items
const formatPrice = (price: string | undefined): string => {
  if (!price) return 'Miễn phí';
  
  const normalizedPrice = price.trim().toLowerCase();
  
  // Check for free indicators
  if (normalizedPrice === '0' || 
      normalizedPrice === '0đ' || 
      normalizedPrice === '0 đ' || 
      normalizedPrice === '0vnd' ||
      normalizedPrice === '0 vnd' ||
      normalizedPrice === 'free' ||
      normalizedPrice === 'miễn phí') {
    return 'Miễn phí';
  }
  
  // Replace VND with ₫ symbol
  return price.replace(/VND/gi, '₫').replace(/đ/g, '₫');
};

function formatVndNumber(value: number): string {
  try {
    return Math.round(value).toLocaleString("vi-VN");
  } catch {
    return String(Math.round(value));
  }
}

function parseVndRange(raw: string | undefined): { min: number; max: number } {
  if (!raw) return { min: 0, max: 0 };
  const text = raw.trim().toLowerCase();
  if (!text) return { min: 0, max: 0 };
  if (text.includes("miễn phí") || text === "free") return { min: 0, max: 0 };

  // Normalize separators and pick up numbers like 150.000, 200000, 150 000
  const normalized = text
    .replace(/₫/g, "")
    .replace(/vnd/g, "")
    .replace(/đ/g, "")
    .replace(/–/g, "-")
    .replace(/,/g, ".");

  const numbers = normalized.match(/\d[\d\.\s]*/g) || [];
  const parsed = numbers
    .map((s) => Number(s.replace(/[\s\.]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 0);

  if (parsed.length === 0) return { min: 0, max: 0 };
  if (parsed.length === 1) return { min: parsed[0], max: parsed[0] };
  return { min: parsed[0], max: parsed[1] };
}

function sumVndRanges(ranges: Array<{ min: number; max: number }>): { min: number; max: number } {
  return ranges.reduce(
    (acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }),
    { min: 0, max: 0 }
  );
}

function vndMidpoint(raw: string | undefined): number {
  const { min, max } = parseVndRange(raw);
  if (min === 0 && max === 0) return 0;
  return Math.round((min + max) / 2);
}

interface PlaceDetails {
  name: string;
  address: string;
  rating: number;
  total_ratings: number;
  photo_url: string;
  lat: number;
  lng: number;
  types?: string[];
  place_id?: string;
  google_maps_link?: string;
  booking_link?: string;
  is_hotel?: boolean;
}

function googleMapsHref(details?: PlaceDetails): string {
  if (!details) return "";
  if (details.google_maps_link) return details.google_maps_link;
  if (details.place_id) {
    return `https://www.google.com/maps/search/?api=1&query=place_id:${encodeURIComponent(
      details.place_id
    )}`;
  }
  if (typeof details.lat === "number" && typeof details.lng === "number" && details.lat && details.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}`;
  }
  return "";
}

interface Activity {
  client_id?: string;
  time: string;
  place: string;
  description: string;
  estimated_cost: string;
  tips: string;
  place_details?: PlaceDetails;
  _isNew?: boolean;
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
  trip_id?: string;
}

function isHotelLikeQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    t.includes("hotel") ||
    t.includes("khách sạn") ||
    t.includes("khach san") ||
    t.includes("resort") ||
    t.includes("homestay") ||
    t.includes("hostel") ||
    t.includes("villa") ||
    t.includes("motel")
  );
}

function averageCoordsFromDay(day: Day | undefined | null): { lat: number; lng: number } | null {
  if (!day?.activities?.length) return null;
  const coords = day.activities
    .map((a) => ({ lat: a.place_details?.lat, lng: a.place_details?.lng }))
    .filter(
      (c): c is { lat: number; lng: number } =>
        typeof c.lat === "number" &&
        typeof c.lng === "number" &&
        c.lat !== 0 &&
        c.lng !== 0
    );
  if (coords.length === 0) return null;
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return { lat, lng };
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return `cid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureActivityIds(plan: TripPlan): TripPlan {
  let changed = false;

  const days = plan.days.map((day) => {
    const activities = day.activities.map((activity) => {
      if (activity.client_id) return activity;
      changed = true;
      return { ...activity, client_id: newClientId() };
    });
    return { ...day, activities };
  });

  if (!changed) return plan;
  return { ...plan, days };
}

// Helper function to parse time string (e.g., "08:00" or "08:00 - 10:00")
function parseTime(timeStr: string): { start: number; end: number; duration: number } {
  try {
    const parts = timeStr.split("-").map((t) => t.trim());
    const parseHourMin = (t: string) => {
      const cleaned = t.replace(/[^\d:]/g, ""); // Remove non-digit/colon characters
      const [hour, min] = cleaned.split(":").map(Number);
      if (isNaN(hour)) return null;
      return hour * 60 + (min || 0);
    };
    
    const start = parseHourMin(parts[0]);
    if (start === null) throw new Error("Invalid start time");
    
    const end = parts.length > 1 ? parseHourMin(parts[1]) : start + 120; // default 2 hours
    const duration = end && end > start ? end - start : 120; // default 2 hours if invalid
    
    return { start, end: end || start + 120, duration };
  } catch {
    // Fallback for malformed time strings
    return { start: 8 * 60, end: 10 * 60, duration: 120 };
  }
}

// Helper function to format minutes to time string
function formatTime(minutes: number): string {
  // Handle overflow past midnight
  const normalizedMins = minutes % (24 * 60);
  const hours = Math.floor(normalizedMins / 60);
  const mins = normalizedMins % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Helper function to recalculate all times based on activity order
function recalculateActivityTimes(activities: Activity[], preserveGaps: boolean = false): Activity[] {
  if (activities.length === 0) return activities;
  
  // Parse all activities to get their durations and gaps
  const parsedActivities = activities.map((activity, index) => {
    const parsed = parseTime(activity.time);
    let gap = 0;
    
    // Calculate gap between this activity and the next one (if preserving gaps)
    if (preserveGaps && index < activities.length - 1) {
      try {
        const nextParsed = parseTime(activities[index + 1].time);
        gap = Math.max(0, nextParsed.start - parsed.end); // Gap between end of this and start of next
        // Cap maximum gap at 2 hours to avoid unrealistic schedules
        gap = Math.min(gap, 120);
      } catch {
        gap = 0;
      }
    }
    
    return {
      activity,
      parsed,
      gap,
    };
  });
  
  // Start from the first activity's original start time
  let currentStartTime = parsedActivities[0].parsed.start;
  
  return parsedActivities.map(({ activity, parsed, gap }, index) => {
    const startTime = currentStartTime;
    const endTime = startTime + parsed.duration;
    
    // Next activity starts after this one ends, plus any gap
    currentStartTime = endTime + gap;
    
    return {
      ...activity,
      time: `${formatTime(startTime)} - ${formatTime(endTime)}`,
    };
  });
}

// Sortable Activity Card Component
interface SortableActivityProps {
  id: string;
  activity: Activity;
  activityIdx: number;
  dayIndex: number;
  isEditing: boolean;
  isModalOpen: boolean;
  onEdit: (field: keyof Activity, value: string) => void;
  onOpenTimeEdit: (currentTime: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onDelete: () => void;
  onResolvePlace: (query: string) => void;
  isResolving: boolean;
  t: (key: string) => string;
}

function SortableActivity({
  id,
  activity,
  activityIdx,
  dayIndex,
  isEditing,
  isModalOpen,
  onEdit,
  onOpenTimeEdit,
  onStartEdit,
  onFinishEdit,
  onDelete,
  onResolvePlace,
  isResolving,
  t,
}: SortableActivityProps) {
  const [showTips, setShowTips] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isModalOpen });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card bg-white shadow-lg hover:shadow-xl transition-shadow relative z-0"
    >
      <div className="card-body">
        <div className="flex justify-between items-start gap-3">
          <div className="flex gap-3 flex-1 min-w-0">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-move flex items-start pt-2 text-gray-400 hover:text-gray-600 touch-none select-none"
              title="Drag to reorder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              {/* Time (Manual Edit), Price, Tips Toggle - All in one row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    onOpenTimeEdit(activity.time);
                  }}
                  className="btn btn-xs btn-primary gap-1"
                  title="Chỉnh sửa thời gian"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {activity.time}
                </button>

                {/* Price Badge */}
                {/* {isEditing ? (
                  <input
                    type="text"
                    className="input input-bordered input-sm w-44"
                    placeholder={t("plan.estimatedCost")}
                    value={activity.estimated_cost}
                    onChange={(e) => onEdit("estimated_cost", e.target.value)}
                  />
                ) : (
                  <div className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full whitespace-nowrap">
                    {formatPrice(activity.estimated_cost)}
                  </div>
                )} */}

                {/* Tips Toggle Button */}
                {/* {activity.tips && !isEditing && (
                  <button
                    onClick={() => setShowTips(!showTips)}
                    className={`btn btn-xs gap-1 ${showTips ? 'btn-info' : 'btn-ghost btn-outline'}`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Tips
                    <svg className={`w-3 h-3 transition-transform ${showTips ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )} */}
              </div>

              {(isEditing || activity._isNew || !activity.place) ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder={t("Nhập địa điểm")}
                    value={activity.place}
                    autoFocus={Boolean(activity._isNew || !activity.place)}
                    onChange={(e) => onEdit("place", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onResolvePlace(activity.place);
                      }
                    }}
                  />
                  <button
                    className={`btn btn-sm btn-outline ${isResolving ? "loading" : ""}`}
                    onClick={() => onResolvePlace(activity.place)}
                    disabled={isResolving}
                    title="Search and enrich"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2 min-w-0">
                  <button className="text-left min-w-0" onClick={onStartEdit} title="Edit">
                    <h3 className="text-xl font-bold text-gray-800 truncate">{activity.place}</h3>
                  </button>
                  {/* Booking.com link for hotels */}
                  {activity.place_details?.is_hotel && activity.place_details?.booking_link && (
                    <a
                      href={activity.place_details.booking_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-xs btn-outline gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                      title="Đặt phòng trên Booking.com"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                      </svg>
                      Booking
                    </a>
                  )}
                </div>
              )}

              {activity.place_details?.address && (
                <div className="mb-3">
                  <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm text-gray-700 flex-1">
                      {activity.place_details.address}
                    </p>
                  </div>
                  {(() => {
                    const href = googleMapsHref(activity.place_details);
                    if (!href) return null;
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {t("plan.openMaps")}
                      </a>
                    );
                  })()}
                </div>
              )}

              {activity.place_details && activity.place_details.rating > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                    <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                    <span className="text-sm font-semibold text-yellow-700">{activity.place_details.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    ({activity.place_details.total_ratings} {t("plan.reviews")})
                  </span>
                </div>
              )}

              {/* {isEditing ? (
                <textarea
                  className="textarea textarea-bordered w-full mb-2"
                  value={activity.description}
                  onChange={(e) => onEdit("description", e.target.value)}
                />
              ) : (
                <p className="text-gray-700 mb-3">{activity.description}</p>
              )} */}

              {/* Collapsible Tips Section */}
              {activity.tips && (showTips || isEditing) && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg mb-3 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-blue-900">Tips:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full mt-1"
                          value={activity.tips}
                          onChange={(e) => onEdit("tips", e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-blue-800 mt-1">{activity.tips}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activity.place_details?.photo_url && (
                <div className="mt-3">
                  <img
                    src={activity.place_details.photo_url}
                    alt={activity.place}
                    className="rounded-lg w-full max-h-64 object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4">
            {isEditing ? (
              <button className="btn btn-success btn-sm" onClick={onFinishEdit}>
                {t("plan.done")}
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={onStartEdit}>
                Sửa
              </button>
            )}
            <button className="btn btn-ghost btn-sm text-error" onClick={onDelete}>
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableRouteItem({
  id,
  index,
  label,
}: {
  id: string;
  index: number;
  label: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-grab active:cursor-grabbing touch-none select-none"
      {...attributes}
      {...listeners}
    >
      <div className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Drag to reorder">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>
      <div className="text-sm font-medium text-gray-800 min-w-0 truncate">{label || ""}</div>
    </div>
  );
}

export default function TripPlanPage() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { user, loading: authLoading, getIdToken } = useAuth();
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripParams, setTripParams] = useState<any>(null);
  const [backHref, setBackHref] = useState<string | null>(null);
  const [backLabel, setBackLabel] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [editingActivity, setEditingActivity] = useState<{
    dayIndex: number;
    activityIndex: number;
  } | null>(null);
  const [showPackingList, setShowPackingList] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [isRouteMapCollapsed, setIsRouteMapCollapsed] = useState(false);
  const [isWeatherCollapsed, setIsWeatherCollapsed] = useState(false);
  const [resolvingActivityIds, setResolvingActivityIds] = useState<Record<string, boolean>>({});
  const [activeRouteSegmentStartIndex, setActiveRouteSegmentStartIndex] = useState<number | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [timeEditTarget, setTimeEditTarget] = useState<{
    dayIndex: number;
    activityIndex: number;
    currentTime: string;
  } | null>(null);
  const [timeEditInput, setTimeEditInput] = useState<string>("");
  const isTimeEditOpen = Boolean(timeEditTarget);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const storedPlan = localStorage.getItem("tripPlan");
    const storedParams = localStorage.getItem("tripParams");
    const storedBackHref = localStorage.getItem("planBackHref");
    const storedBackLabel = localStorage.getItem("planBackLabel");

    if (storedBackHref) {
      setBackHref(storedBackHref);
      localStorage.removeItem("planBackHref");
    }
    if (storedBackLabel) {
      setBackLabel(storedBackLabel);
      localStorage.removeItem("planBackLabel");
    }

    if (storedPlan) {
      const parsed = JSON.parse(storedPlan);
      const withIds = ensureActivityIds(parsed);
      setTripPlan(withIds);
      localStorage.setItem("tripPlan", JSON.stringify(withIds));
    } else {
      router.push("/trip/input");
    }

    if (storedParams) {
      setTripParams(JSON.parse(storedParams));
    }
  }, [router]);

  useEffect(() => {
    setActiveRouteSegmentStartIndex(null);
  }, [selectedDay]);

  useEffect(() => {
    if (!isTimeEditOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isTimeEditOpen]);

  const openTimeEdit = (dayIndex: number, activityIndex: number, currentTime: string) => {
    setTimeEditTarget({ dayIndex, activityIndex, currentTime });
    setTimeEditInput(currentTime);
  };

  const closeTimeEdit = () => {
    setTimeEditTarget(null);
    setTimeEditInput("");
  };

  const handleSavePlan = async () => {
    if (!tripPlan?.trip_id) return;
    if (savingPlan) return;

    try {
      setSavingPlan(true);

      const token = await getIdToken?.();
      if (!token) {
        alert(language === "en" ? "You need to sign in to save." : "Bạn cần đăng nhập để lưu.");
        return;
      }

      const response = await fetch(`/api/trip/${tripPlan.trip_id}/plan`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trip_plan: tripPlan }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save plan");
      }

      alert(language === "en" ? "Saved successfully." : "Đã lưu kế hoạch.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(language === "en" ? `Save failed: ${msg}` : `Lưu thất bại: ${msg}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !tripPlan) return;

    const dayIndex = tripPlan.days.findIndex((d) => d.day === selectedDay);
    if (dayIndex === -1) return;

    const currentActivities = tripPlan.days[dayIndex].activities;
    const oldIndex = currentActivities.findIndex((a) => a.client_id === active.id);
    const newIndex = currentActivities.findIndex((a) => a.client_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: arrayMove(currentActivities, oldIndex, newIndex),
    };
    
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
  };

  const handleRouteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !tripPlan) return;

    const dayIndex = tripPlan.days.findIndex((d) => d.day === selectedDay);
    if (dayIndex === -1) return;

    const activeId = String(active.id).replace(/^route:/, "");
    const overId = String(over.id).replace(/^route:/, "");

    const currentActivities = tripPlan.days[dayIndex].activities;
    const oldIndex = currentActivities.findIndex((a) => a.client_id === activeId);
    const newIndex = currentActivities.findIndex((a) => a.client_id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: arrayMove(currentActivities, oldIndex, newIndex),
    };

    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
  };

  const handleInsertActivity = (
    dayIndex: number,
    activityIndex: number,
    position: "above" | "below"
  ) => {
    if (!tripPlan) return;

    const insertAt = position === "above" ? activityIndex : activityIndex + 1;
    const newActivity: Activity = {
      client_id: newClientId(),
      time: "08:00 - 10:00",
      place: "",
      description: "",
      estimated_cost: "",
      tips: "",
      _isNew: true,
    };

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: [...newPlan.days[dayIndex].activities],
    };
    newPlan.days[dayIndex].activities.splice(insertAt, 0, newActivity);

    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));

    setEditingActivity({ dayIndex, activityIndex: insertAt });
  };

  const handleResolvePlace = async (
    dayIndex: number,
    activityIndex: number,
    query: string
  ) => {
    if (!tripPlan) return;

    const activity = tripPlan.days[dayIndex]?.activities?.[activityIndex];
    const activityId = activity?.client_id;
    if (!activityId) return;

    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setResolvingActivityIds((prev) => ({ ...prev, [activityId]: true }));

      const destination = (tripParams?.destination || "").trim();
      const locationCoords = averageCoordsFromDay(tripPlan.days?.[dayIndex]);
      const placeTypeHint = isHotelLikeQuery(trimmed) ? "lodging" : undefined;
      const response = await fetch("/api/trip/resolve-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          query: trimmed,
          budget: tripParams?.budget,
          location_coords: locationCoords,
          place_type_hint: placeTypeHint,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to resolve place");
      }

      const newPlan = { ...tripPlan };
      newPlan.days = [...newPlan.days];
      newPlan.days[dayIndex] = {
        ...newPlan.days[dayIndex],
        activities: [...newPlan.days[dayIndex].activities],
      };

      const current = newPlan.days[dayIndex].activities[activityIndex];
      newPlan.days[dayIndex].activities[activityIndex] = {
        ...current,
        place: data?.place || current.place || trimmed,
        description: data?.description || current.description,
        estimated_cost: data?.estimated_cost || current.estimated_cost,
        tips: data?.tips || current.tips,
        place_details: data?.place_details || current.place_details,
        _isNew: false,
      };

      setTripPlan(newPlan);
      localStorage.setItem("tripPlan", JSON.stringify(newPlan));
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingActivityIds((prev) => ({ ...prev, [activityId]: false }));
    }
  };

  const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
    if (!tripPlan) return;

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: [...newPlan.days[dayIndex].activities],
    };
    newPlan.days[dayIndex].activities.splice(activityIndex, 1);
    
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
  };

  const handleEditActivity = (
    dayIndex: number,
    activityIndex: number,
    field: keyof Activity,
    value: string
  ) => {
    if (!tripPlan) return;

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: [...newPlan.days[dayIndex].activities],
    };
    const current = newPlan.days[dayIndex].activities[activityIndex];
    newPlan.days[dayIndex].activities[activityIndex] = {
      ...current,
      [field]: value,
    } as Activity;
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
  };

  if (!tripPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const currentDay = tripPlan.days.find((d) => d.day === selectedDay);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-md sticky top-0 z-50">
        <div className="navbar-start">
          <button
              onClick={() => router.push(backHref || "/trip/input")}
            className="btn btn-ghost"
          >
              {backLabel || t("plan.back")}
          </button>
        </div>
        <div className="navbar-center">
          <span className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {tripPlan.trip_name}
          </span>
        </div>
        <div className="navbar-end">
          {tripPlan?.trip_id && !authLoading && user && (
            <button
              type="button"
              className={`btn btn-primary btn-sm ${savingPlan ? "loading" : ""}`}
              onClick={handleSavePlan}
              disabled={savingPlan}
              title={language === "en" ? "Save plan" : "Lưu kế hoạch"}
            >
              {language === "en" ? "Save plan" : "Lưu kế hoạch"}
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl mobile-container">
        {/* Header Card */}
        <div className="card bg-white shadow-xl mb-8 mobile-compact">
          <div className="card-body">
            {/* Cover Image */}
            {tripPlan.cover_image && (
              <div className="relative h-64 w-full rounded-xl overflow-hidden mb-6">
                <img
                  src={tripPlan.cover_image}
                  alt={tripPlan.trip_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              </div>
            )}

            {/* Title */}
            <h2 className="text-3xl font-bold mb-6 mobile-heading">{tripPlan.trip_name}</h2>
            
            {/* 6 Badges in One Row - Fill Width */}
            <div className="flex flex-wrap gap-2 mb-6">
              {/* Total Cost Card - Larger */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300 shadow-sm flex-1 min-w-0">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[10px] text-blue-600 font-semibold">{language === "en" ? "Total Cost" : "Tổng chi phí"}</div>
                  <div className="font-bold text-gray-800 text-sm truncate">
                    {formatPrice(tripPlan.total_estimated_cost)}
                  </div>
                </div>
              </div>

              {tripParams && (
                <>
                  {/* Time Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-pink-50 rounded-lg border border-pink-200 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-pink-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-pink-600 font-medium">{language === "en" ? "Time" : "Thời gian"}</div>
                      <div className="font-bold text-gray-800 text-xs truncate">{tripParams.duration} {language === "en" ? "day" : "ngày"}</div>
                    </div>
                  </div>

                  {/* Budget Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-green-50 rounded-lg border border-green-200 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-green-600 font-medium">{language === "en" ? "Budget" : "Ngân sách"}</div>
                      <div className="font-bold text-gray-800 text-xs truncate">{tripParams.budget === "low" ? (language === "en" ? "Low" : "Thấp") : tripParams.budget === "medium" ? (language === "en" ? "Medium" : "Trung bình") : (language === "en" ? "High" : "Cao")}</div>
                    </div>
                  </div>

                  {/* Activity Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-purple-50 rounded-lg border border-purple-200 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-purple-600 font-medium">{language === "en" ? "Activity" : "Hoạt động"}</div>
                      <div className="font-bold text-gray-800 text-xs truncate">{tripParams.activity_level === "low" ? (language === "en" ? "Low" : "Thấp") : tripParams.activity_level === "medium" ? (language === "en" ? "Medium" : "Trung bình") : (language === "en" ? "High" : "Cao")}</div>
                    </div>
                  </div>
                </>
              )}

              {/* Packing List Button - Compact */}
              <button
                onClick={() => setShowPackingList(!showPackingList)}
                className={`flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border transition-all tap-target ${
                  showPackingList 
                    ? 'border-orange-400 shadow-md scale-105' 
                    : 'border-orange-200 hover:shadow-sm hover:border-orange-300'
                }`}
              >
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="font-bold text-orange-700 text-sm">{tripPlan.packing_list?.length || 0}</span>
              </button>

              {/* Travel Tips Button - Compact */}
              <button
                onClick={() => setShowTips(!showTips)}
                className={`flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border transition-all tap-target ${
                  showTips 
                    ? 'border-teal-400 shadow-md scale-105' 
                    : 'border-teal-200 hover:shadow-sm hover:border-teal-300'
                }`}
              >
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="font-bold text-teal-700 text-sm">{tripPlan.travel_tips?.length || 0}</span>
              </button>
            </div>

            {/* Overview */}
            <div className="mt-6">
              <p className="text-gray-600 leading-relaxed mobile-text-base">{tripPlan.overview}</p>
            </div>

          </div>
        </div>

        {/* Weather Forecast */}
        {tripPlan.weather_forecast && tripPlan.weather_forecast.length > 0 && (
          <div className="mt-12 card bg-white shadow-xl mobile-compact">
            <div className="card-body">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6c0 4.314 6 10 6 10s6-5.686 6-10a6 6 0 00-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
                  </svg>
                  <h3 className="text-2xl font-bold text-gray-800 mobile-heading">
                    {language === "en" ? "Weather Forecast for Your Trip" : "Dự báo thời tiết cho chuyến đi"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsWeatherCollapsed(!isWeatherCollapsed)}
                  className="btn btn-xs btn-ghost"
                  title={isWeatherCollapsed ? "Mở rộng" : "Thu gọn"}
                >
                  <svg className={`w-5 h-5 transition-transform ${isWeatherCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {!isWeatherCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {tripPlan.weather_forecast.map((weather: any, idx: number) => (
                    <div key={idx} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 shadow-sm border border-blue-100 mobile-full-card">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-700">
                            {language === "en" ? `Day ${weather.day}` : `Ngày ${weather.day}`}
                          </div>
                          <div className="text-xs text-gray-500">{weather.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {weather.temp_max}°
                          </div>
                          <div className="text-xs text-gray-500">{weather.temp_min}°C</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                          </svg>
                          <span className="text-gray-700 font-medium">{weather.condition}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/>
                          </svg>
                          <span>{language === "en" ? "Rain" : "Mưa"}: {weather.rain_chance}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
                          </svg>
                          <span>{language === "en" ? "Humidity" : "Độ ẩm"}: {weather.humidity}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Section */}
        {currentDay ? (
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Day Selector Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-white shadow-lg sticky top-24 mobile-compact">
              <div className="card-body p-4">
                <h3 className="card-title text-base mb-3">{language === "en" ? "Schedule" : "Lịch Trình"}</h3>
                <div className="space-y-2">
                  {tripPlan.days.map((day) => (
                    <button
                      key={day.day}
                      onClick={() => setSelectedDay(day.day)}
                      className={`btn w-full justify-center tap-target ${
                        selectedDay === day.day
                          ? "btn-primary"
                          : "btn-ghost btn-outline"
                      }`}
                    >
                      <span className="font-bold">{t("plan.day")} {day.day}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Route Table (drag & drop) */}
            {currentDay && (
              <div className="mt-4">
                <div className="card bg-white shadow-lg mobile-compact">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <h3 className="text-base font-bold text-gray-800">{language === "en" ? "Route" : "Lộ trình"}</h3>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{t("plan.dragToReorder")}</div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRouteDragEnd}>
                      <SortableContext
                        items={currentDay.activities
                          .map((a) => a.client_id)
                          .filter((id): id is string => Boolean(id))
                          .map((id) => `route:${id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1">
                          {currentDay.activities.map((a, activityIdx) =>
                            a.client_id ? (
                            <button
                              key={a.client_id}
                              type="button"
                              className="w-full text-left"
                              onClick={() => {
                                if (!currentDay) return;
                                // Map indexes are based on the subset of activities that have coordinates.
                                const activityIdxWithCoords = currentDay.activities
                                  .map((act, actIdx) =>
                                    act.place_details?.lat && act.place_details?.lng ? actIdx : null
                                  )
                                  .filter((v): v is number => v !== null);

                                const endLocIdx = activityIdxWithCoords.indexOf(activityIdx);
                                if (endLocIdx === -1) return;

                                // Clicking location 1 (first routable point) shows the full route.
                                if (endLocIdx === 0) {
                                  setActiveRouteSegmentStartIndex(null);
                                  return;
                                }

                                // Clicking location N shows segment (N-1) -> N.
                                setActiveRouteSegmentStartIndex(endLocIdx - 1);
                              }}
                              title="Xem tuyến"
                            >
                              <SortableRouteItem id={`route:${a.client_id!}`} index={activityIdx} label={a.place} />
                            </button>
                            ) : null
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>
            )}
            
            {/* Items and Tips boxes - directly under Schedule */}
            <div className="mt-4 space-y-4">
              {showPackingList && tripPlan.packing_list && (
                <div className="card bg-white shadow-lg mobile-compact">
                  <div className="card-body p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <h3 className="text-sm font-bold text-gray-800">
                        {t("plan.packingList.title")}
                      </h3>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      {tripPlan.packing_list.map((item, idx) => (
                        <li key={idx} className="text-gray-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {showTips && tripPlan.travel_tips && (
                <div className="card bg-white shadow-lg mobile-compact">
                  <div className="card-body p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h3 className="text-sm font-bold text-gray-800">{t("plan.travelTips.title")}</h3>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-xs">
                      {tripPlan.travel_tips.map((tip, idx) => (
                        <li key={idx} className="text-gray-700" dangerouslySetInnerHTML={{
                          __html: tip
                            .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                        }} />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activities Content */}
          <div className="lg:col-span-4">
            {/* Route Map */}
            {currentDay && currentDay.activities.some(a => a.place_details?.lat && a.place_details?.lng) && (
              <div className="mb-6">
                <div className="card bg-white shadow-lg mobile-compact">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <h3 className="text-lg font-bold text-gray-800 mobile-heading">
                          {language === "en" ? "Route Map" : "Bản đồ lộ trình"}
                        </h3>
                      </div>
                      <button
                        onClick={() => setIsRouteMapCollapsed(!isRouteMapCollapsed)}
                        className="btn btn-xs btn-ghost"
                        title={isRouteMapCollapsed ? "Mở rộng" : "Thu gọn"}
                      >
                        <svg className={`w-5 h-5 transition-transform ${isRouteMapCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {!isRouteMapCollapsed && (
                    <RouteMap
                      locations={currentDay.activities.reduce(
                        (acc, a, idx) => {
                          const lat = a.place_details?.lat;
                          const lng = a.place_details?.lng;
                          if (typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0) {
                            acc.push({
                              lat,
                              lng,
                              name: a.place,
                              time: a.time,
                              seq: idx + 1,
                            });
                          }
                          return acc;
                        },
                        [] as { lat: number; lng: number; name: string; time?: string; seq?: number }[]
                      )}
                      activeSegmentStartIndex={activeRouteSegmentStartIndex}
                      onLocationClick={(idx) => {
                        // Clicking marker 1 shows the full route.
                        if (idx === 0) {
                          setActiveRouteSegmentStartIndex(null);
                          return;
                        }

                        // Clicking marker N shows segment (N-1) -> N.
                        setActiveRouteSegmentStartIndex(idx - 1);
                      }}
                      travelMode={tripParams?.travel_mode}
                      height="350px"
                    />
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {currentDay && (
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-2xl font-bold mobile-heading">
                      {language === "en" ? `Day ${currentDay.day}` : `Ngày ${currentDay.day}`}
                    </h2>
                    <div className="badge badge-outline font-bold text-blue-700 border-blue-700">
                      {language === "en"
                        ? `Total cost: ${formatVndNumber(
                            currentDay.activities.reduce(
                              (acc, a) => acc + vndMidpoint(a.estimated_cost),
                              0
                            )
                          )} đ`
                        : `Tổng chi phí: ${formatVndNumber(
                            currentDay.activities.reduce(
                              (acc, a) => acc + vndMidpoint(a.estimated_cost),
                              0
                            )
                          )} đ`}
                    </div>
                  </div>
                  <div className="divider"></div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={currentDay.activities
                      .map((a) => a.client_id)
                      .filter((id): id is string => Boolean(id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-6">
                      {currentDay.activities.map((activity, activityIdx) => {
                        const dayIndex = tripPlan.days.findIndex((d) => d.day === selectedDay);
                        const isEditing =
                          editingActivity?.dayIndex === dayIndex &&
                          editingActivity?.activityIndex === activityIdx;

                        return (
                          <div key={activity.client_id || `${dayIndex}-${activityIdx}`} className="group">
                            {/* Hover Insert/Delete Controls */}
                            {!isTimeEditOpen && (
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity my-2 relative z-20">
                                <div className="flex-1 h-px bg-gray-200"></div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleInsertActivity(dayIndex, activityIdx, "above")}
                                    className="btn btn-xs btn-circle btn-primary"
                                    title="Thêm chuyến đi"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteActivity(dayIndex, activityIdx)}
                                    className="btn btn-xs btn-circle btn-outline btn-ghost text-red-600 border-red-300"
                                    title="Xoá"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m2 0V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="flex-1 h-px bg-gray-200"></div>
                              </div>
                            )}

                            <SortableActivity
                              id={activity.client_id!}
                              activity={activity}
                              activityIdx={activityIdx}
                              dayIndex={dayIndex}
                              isEditing={isEditing}
                              isModalOpen={isTimeEditOpen}
                              onEdit={(field, value) =>
                                handleEditActivity(dayIndex, activityIdx, field, value)
                              }
                              onOpenTimeEdit={(currentTime) =>
                                openTimeEdit(dayIndex, activityIdx, currentTime)
                              }
                              onStartEdit={() =>
                                setEditingActivity({ dayIndex, activityIndex: activityIdx })
                              }
                              onFinishEdit={() => setEditingActivity(null)}
                              onDelete={() => handleDeleteActivity(dayIndex, activityIdx)}
                              onResolvePlace={(q) => handleResolvePlace(dayIndex, activityIdx, q)}
                              isResolving={Boolean(activity.client_id && resolvingActivityIds[activity.client_id])}
                              t={t}
                            />

                            {/* Insert Below Button (only show for last item) */}
                            {activityIdx === currentDay.activities.length - 1 && (
                              !isTimeEditOpen && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity my-2 relative z-20">
                                  <div className="flex-1 h-px bg-gray-200"></div>
                                  <button
                                    onClick={() => handleInsertActivity(dayIndex, activityIdx, "below")}
                                    className="btn btn-xs btn-circle btn-primary"
                                    title="Thêm chuyến đi"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                                    </svg>
                                  </button>
                                  <div className="flex-1 h-px bg-gray-200"></div>
                                </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-6" />
        )}
        {/* Time edit modal rendered at page level to avoid Leaflet/DnD stacking context issues */}
        {isTimeEditOpen && timeEditTarget && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999]"
            role="dialog"
            aria-modal="true"
            onClick={closeTimeEdit}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-bold">Chỉnh sửa thời gian</h3>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-full mb-4"
                placeholder="VD: 08:00 - 10:00"
                value={timeEditInput}
                onChange={(e) => setTimeEditInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEditActivity(timeEditTarget.dayIndex, timeEditTarget.activityIndex, "time", timeEditInput);
                    closeTimeEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeTimeEdit();
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    handleEditActivity(timeEditTarget.dayIndex, timeEditTarget.activityIndex, "time", timeEditInput);
                    closeTimeEdit();
                  }}
                >
                  Lưu
                </button>
                <button className="btn btn-sm btn-outline btn-primary" onClick={closeTimeEdit}>
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
