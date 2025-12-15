"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
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

// Format date as dd/mm/yyyy (avoid timezone shift for YYYY-MM-DD strings)
const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const s = String(dateString);
  const isoOnly = /^\d{4}-\d{2}-\d{2}$/;
  const date = isoOnly.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
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

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.asin(Math.sqrt(h));
}

function dayTotalDistanceKm(day: Day | undefined | null): number {
  if (!day?.activities?.length) return 0;
  const points = day.activities
    .map((a) => ({ lat: a.place_details?.lat, lng: a.place_details?.lng }))
    .filter(
      (p): p is { lat: number; lng: number } =>
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        p.lat !== 0 &&
        p.lng !== 0
    );
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

function formatKm(km: number): string {
  if (!km || km <= 0) return "0 km";
  try {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(km)} km`;
  } catch {
    return `${km.toFixed(1)} km`;
  }
}

function normalizeTravelModeKey(raw: unknown): "walk" | "motorbike" | "car" | "public" | "bicycle" | "other" {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v === "đi bộ" || v === "walk" || v === "walking") return "walk";
  if (v === "xe máy" || v === "motorbike" || v === "motorcycle") return "motorbike";
  if (v === "ô tô" || v === "oto" || v === "car" || v === "driving") return "car";
  if (v.includes("công cộng") || v.includes("public") || v.includes("transit") || v.includes("bus") || v.includes("metro")) return "public";
  if (v === "xe đạp" || v === "bicycle" || v === "bike" || v === "cycling") return "bicycle";
  return "other";
}

function formatTravelMode(raw: unknown, language: string): string {
  const key = normalizeTravelModeKey(raw);
  if (language === "en") {
    if (key === "walk") return "Walk";
    if (key === "motorbike") return "Motorbike";
    if (key === "car") return "Car";
    if (key === "public") return "Public transport";
    if (key === "bicycle") return "Bicycle";
    return String(raw ?? "-") || "-";
  }

  if (key === "walk") return "Đi bộ";
  if (key === "motorbike") return "Xe máy";
  if (key === "car") return "Ô tô";
  if (key === "public") return "Phương tiện công cộng";
  if (key === "bicycle") return "Xe đạp";
  return String(raw ?? "-") || "-";
}

function TravelModeIcon({ mode, className }: { mode: unknown; className: string }) {
  const key = normalizeTravelModeKey(mode);
  if (key === "walk") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="10" cy="5" r="2" strokeWidth={2.2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 7l-2 4 3 2 1 8" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 11l-3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 10l3 2 3-1" />
      </svg>
    );
  }

  if (key === "motorbike") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="7" cy="17" r="2" strokeWidth={2} />
        <circle cx="17" cy="17" r="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h4l2-5h3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12h3l1 2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 17h1" />
      </svg>
    );
  }

  if (key === "car") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 13l2-5h12l2 5v6h-2a2 2 0 01-4 0H10a2 2 0 01-4 0H4v-6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 13h10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 8l2-3h4l2 3" />
      </svg>
    );
  }

  if (key === "public") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 3h10a3 3 0 013 3v11a3 3 0 01-3 3H7a3 3 0 01-3-3V6a3 3 0 013-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 8h10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 17h0.01M15 17h0.01" />
      </svg>
    );
  }

  if (key === "bicycle") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="7" cy="17" r="2" strokeWidth={2.2} />
        <circle cx="17" cy="17" r="2" strokeWidth={2.2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 17l3-7h3l3 7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 10h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 10l-2 3" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function inferGroupSize(params: any): number {
  const raw = params?.group_size ?? params?.groupSize;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const g = String(params?.travel_group ?? params?.travelGroup ?? "").trim().toLowerCase();
  if (g === "solo") return 1;
  if (g === "couple") return 2;
  return 1;
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

type PlaceSuggestion = PlaceDetails & { is_ad?: boolean };

type TimeAdjustMode = "push_preserve_gaps" | "push_compact" | "keep_following";

type ToastType = "success" | "error" | "info";

function normalizePlaceKey(text: string): string {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildExistingPlaceKeySet(activities: Activity[], excludeIndex: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < (activities || []).length; i++) {
    if (i === excludeIndex) continue;
    const a = activities[i];
    const pid = a?.place_details?.place_id;
    if (pid) s.add(`pid:${pid}`);
    const p1 = normalizePlaceKey(a?.place || "");
    if (p1) s.add(`name:${p1}`);
    const p2 = normalizePlaceKey(a?.place_details?.name || "");
    if (p2) s.add(`name:${p2}`);
  }
  return s;
}

function isSensitiveSuggestionText(text: string): boolean {
  const s = (text || "").toLowerCase();
  const banned = [
    /cung\s*c[aáàảãạ]p\s*girl/i,
    /\bgirl\b/i,
    /\bg[aáàảãạ]i\b/i,
    /escort/i,
    /massage/i,
  ];
  return banned.some((r) => r.test(s));
}

function isFoodSuggestion(types?: string[]): boolean {
  const t = (types || []).map((x) => String(x || "").toLowerCase());
  return t.some((x) =>
    ["restaurant", "cafe", "meal_takeaway", "meal_delivery", "bakery", "bar"].includes(x)
  );
}

function isValidTimeRangeText(text: string): boolean {
  return /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/.test(text || "");
}

function hashStringToInt(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function decorateSuggestionsWithAds(activityId: string, suggestions: PlaceDetails[]): PlaceSuggestion[] {
  const filtered = (suggestions || [])
    .filter((s) => {
      const name = String(s?.name || "");
      const address = String(s?.address || "");
      return !(isSensitiveSuggestionText(name) || isSensitiveSuggestionText(address));
    })
    .slice(0, 5);

  if (filtered.length === 0) return [];

  const h = hashStringToInt(activityId);
  const adCount = filtered.length >= 2 ? ((h % 2) + 1) : 1;

  const foodIdxs = filtered
    .map((s, idx) => (isFoodSuggestion(s.types) ? idx : -1))
    .filter((idx) => idx >= 0);
  const candidates = foodIdxs.length > 0 ? foodIdxs : filtered.map((_, idx) => idx);

  const idxs = new Set<number>();
  for (let i = 0; i < adCount; i++) {
    idxs.add(candidates[(h + i * 7) % candidates.length]);
  }

  const tagged = filtered.map((s, index) => ({ ...s, is_ad: idxs.has(index), _index: index } as any));
  tagged.sort((a: any, b: any) => {
    const adA = a.is_ad ? 1 : 0;
    const adB = b.is_ad ? 1 : 0;
    if (adA !== adB) return adB - adA;
    return a._index - b._index;
  });
  return tagged.map(({ _index, ...rest }: any) => rest);
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
    const normalizedInput = (timeStr || "")
      .replace(/[–—]/g, "-")
      .replace(/\s+to\s+/gi, "-");
    const parts = normalizedInput.split("-").map((t) => t.trim());
    const parseHourMin = (t: string) => {
      const cleaned = t.replace(/[^\d:]/g, ""); // Remove non-digit/colon characters
      const [hour, min] = cleaned.split(":").map(Number);
      if (isNaN(hour)) return null;
      return hour * 60 + (min || 0);
    };
    
    const start = parseHourMin(parts[0]);
    if (start === null) throw new Error("Invalid start time");
    
    const end = parts.length > 1 ? parseHourMin(parts[1]) : start + 120; // default 2 hours
    const duration = typeof end === "number" && end > start ? end - start : 120; // default 2 hours if invalid
    
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
  suggestions: PlaceSuggestion[];
  suggestionsLoading: boolean;
  existingPlaceKeys: Set<string>;
  onRequestSuggestions: () => void;
  onPickSuggestion: (s: PlaceSuggestion) => void;
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
  suggestions,
  suggestionsLoading,
  existingPlaceKeys,
  onRequestSuggestions,
  onPickSuggestion,
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
  const showSuggestions = !activity.place;

  useEffect(() => {
    if (!showSuggestions) return;
    if (suggestionsLoading) return;
    if (suggestions && suggestions.length > 0) return;
    onRequestSuggestions();
  }, [showSuggestions, suggestionsLoading, suggestions, onRequestSuggestions]);
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
                {isEditing ? (
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
                )}

                {/* Tips Toggle Button (hidden by default; user must click to reveal) */}
                {activity.tips && !isEditing && (
                  <button
                    onClick={() => setShowTips(!showTips)}
                    className={`btn btn-xs gap-1 ${showTips ? "btn-info" : "btn-ghost btn-outline"}`}
                    title={t("plan.tips.toggle")}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="ml-1">{t("Tips") || "Tips"}</span>
                    <svg className={`w-3 h-3 transition-transform ml-1 ${showTips ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {(isEditing || activity._isNew || !activity.place) ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder={t("Nhập địa điểm")}
                    value={activity.place}
                    autoFocus={Boolean(activity._isNew || !activity.place)}
                    onFocus={() => {
                      if (!activity.place) onRequestSuggestions();
                    }}
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

              {showSuggestions && (
                <div className="mt-2 mb-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    {t("Gợi ý")}
                  </div>
                  {suggestionsLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="loading loading-spinner loading-xs"></span>
                      <span>{t("Đang tải")}</span>
                    </div>
                  )}
                  {!suggestionsLoading && suggestions.length > 0 && (
                    <div className="space-y-2">
                      {suggestions
                        .filter((s) => {
                          const name = String(s?.name || "");
                          const address = String(s?.address || "");
                          return !(isSensitiveSuggestionText(name) || isSensitiveSuggestionText(address));
                        })
                        .filter((s) => {
                          const pid = s?.place_id ? `pid:${String(s.place_id)}` : "";
                          const nameKey = `name:${normalizePlaceKey(String(s?.name || ""))}`;
                          if (pid && existingPlaceKeys.has(pid)) return false;
                          if (existingPlaceKeys.has(nameKey)) return false;
                          return true;
                        })
                        .slice(0, 5)
                        .map((s, idx) => (
                        <button
                          key={`${id}-sug-${idx}`}
                          type="button"
                          className={
                            s.is_ad
                              ? "btn btn-sm w-full justify-start gap-2 border-2 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                              : "btn btn-sm btn-outline w-full justify-start gap-2"
                          }
                          onClick={() => onPickSuggestion(s)}
                        >
                          {s.is_ad && <span className="badge badge-warning">Ads</span>}
                          <span className="truncate flex-1 text-left">{s.name}</span>
                          {typeof s.rating === "number" && s.rating > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                              <svg className="w-3 h-3 text-yellow-500 fill-current" viewBox="0 0 20 20">
                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                              </svg>
                              <span>{s.rating.toFixed(1)}</span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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

              {/* Tips Section */}
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
  const pathname = usePathname();
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
  const [suggestionsByActivityId, setSuggestionsByActivityId] = useState<Record<string, PlaceSuggestion[]>>({});
  const [suggestingActivityIds, setSuggestingActivityIds] = useState<Record<string, boolean>>({});
  const [activeRouteSegmentStartIndex, setActiveRouteSegmentStartIndex] = useState<number | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    dayIndex: number;
    activityIndex: number;
  } | null>(null);

  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineDayIndex, setTimelineDayIndex] = useState<number | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<Record<string, { start: number; end: number; duration: number }>>({});
  const [timelineLocked, setTimelineLocked] = useState<Record<string, boolean>>({});
  const [timelineFocusId, setTimelineFocusId] = useState<string | null>(null);
  const [timelineDragging, setTimelineDragging] = useState<
    | {
        activityId: string;
        action: "resize" | "move";
        edge?: "top" | "bottom";
        startY: number;
        originStart: number;
        originEnd: number;
      }
    | null
  >(null);
  const [timeEditTarget, setTimeEditTarget] = useState<{
    dayIndex: number;
    activityIndex: number;
    currentTime: string;
  } | null>(null);
  const [timeEditInput, setTimeEditInput] = useState<string>("");
  const [timeAdjustMode, setTimeAdjustMode] = useState<TimeAdjustMode>("push_preserve_gaps");
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
      savedSnapshotRef.current = JSON.stringify(withIds);
    } else {
      router.push("/trip/input");
    }

    if (storedParams) {
      setTripParams(JSON.parse(storedParams));
    }
  }, [router]);

  const isDirty = useMemo(() => {
    if (!tripPlan) return false;
    const snap = savedSnapshotRef.current;
    if (!snap) return false;
    try {
      return JSON.stringify(tripPlan) !== snap;
    } catch {
      return true;
    }
  }, [tripPlan]);

  const computedTripTotalVnd = useMemo(() => {
    if (!tripPlan?.days?.length) return 0;
    return tripPlan.days.reduce((sum, day) => {
      const dayTotal = (day.activities || []).reduce(
        (acc, a) => acc + vndMidpoint(a.estimated_cost),
        0
      );
      return sum + dayTotal;
    }, 0);
  }, [tripPlan]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const pushToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const requestLeave = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true);
      return;
    }

    const target = pathname.includes("/edit-plan") && tripPlan?.trip_id
      ? `/trip/${tripPlan.trip_id}`
      : "/";
    router.push(target);
  };

  const requestDeleteActivity = (dayIndex: number, activityIndex: number) => {
    setConfirmDeleteTarget({ dayIndex, activityIndex });
  };

  const performDeleteActivity = () => {
    if (!tripPlan || !confirmDeleteTarget) return;
    const { dayIndex, activityIndex } = confirmDeleteTarget;

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: [...newPlan.days[dayIndex].activities],
    };
    newPlan.days[dayIndex].activities.splice(activityIndex, 1);

    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
    setConfirmDeleteTarget(null);
    pushToast("success", language === "en" ? "Deleted." : "Đã xoá hoạt động.");
  };

  const openTimeEditText = (dayIndex: number, activityIndex: number, currentTime: string) => {
    setTimeEditTarget({ dayIndex, activityIndex, currentTime });
    setTimeEditInput(currentTime);
  };

  const openTimeEdit = (dayIndex: number, activityIndex: number, _currentTime: string) => {
    if (!tripPlan) return;
    const a = tripPlan.days?.[dayIndex]?.activities?.[activityIndex];
    const id = a?.client_id || null;
    openTimeline(dayIndex, id);
  };

  const closeTimeEdit = () => {
    setTimeEditTarget(null);
    setTimeEditInput("");
  };

  const applyTimeEdit = () => {
    if (!tripPlan || !timeEditTarget) return false;
    if (!isValidTimeRangeText(timeEditInput)) return false;

    const { dayIndex, activityIndex } = timeEditTarget;
    const day = tripPlan.days?.[dayIndex];
    if (!day) return false;

    const originalActivities = [...(day.activities || [])];
    const activities = [...originalActivities];

    const parsedNew = parseTime(timeEditInput);
    const bufferMin = 15;

    const duration = Math.max(15, parsedNew.duration);
    let newStart = parsedNew.start;
    const prevParsed = activityIndex > 0 ? parseTime(activities[activityIndex - 1].time) : null;
    if (prevParsed && newStart < prevParsed.end + bufferMin) {
      if (timeAdjustMode === "keep_following") return false;
      newStart = prevParsed.end + bufferMin;
    }

    const newEnd = newStart + duration;
    const normalizedTime = `${formatTime(newStart)} - ${formatTime(newEnd)}`;
    activities[activityIndex] = { ...activities[activityIndex], time: normalizedTime };

    if (timeAdjustMode === "keep_following") {
      if (activityIndex < activities.length - 1) {
        const nextParsed = parseTime(activities[activityIndex + 1].time);
        if (nextParsed.start < newEnd) return false;
      }
    } else {
      const preserveGaps = timeAdjustMode === "push_preserve_gaps";
      let prevEnd = newEnd;
      for (let i = activityIndex + 1; i < activities.length; i++) {
        const curOld = originalActivities[i];
        const curParsedOld = parseTime(curOld.time);
        const duration = curParsedOld.duration;

        let gap = 0;
        if (preserveGaps) {
          const prevOld = originalActivities[i - 1];
          const prevParsedOld = parseTime(prevOld.time);
          gap = Math.max(0, curParsedOld.start - prevParsedOld.end);
          gap = Math.min(gap, 120);
        }

        const startTime = prevEnd + gap;
        const endTime = startTime + duration;
        activities[i] = {
          ...activities[i],
          time: `${formatTime(startTime)} - ${formatTime(endTime)}`,
        };
        prevEnd = endTime;
      }
    }

    const newPlan = { ...tripPlan, days: [...tripPlan.days] };
    newPlan.days[dayIndex] = { ...tripPlan.days[dayIndex], activities };
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
    return true;
  };

  const openTimeline = (dayIndex: number, focusActivityId?: string | null) => {
    if (!tripPlan) return;
    const day = tripPlan.days?.[dayIndex];
    if (!day) return;
    const nextDraft: Record<string, { start: number; end: number; duration: number }> = {};
    for (const a of day.activities || []) {
      const id = a.client_id;
      if (!id) continue;
      const p = parseTime(a.time);
      nextDraft[id] = { start: p.start, end: p.end, duration: p.duration };
    }
    setTimelineDraft(nextDraft);
    setTimelineLocked({});
    setTimelineFocusId(focusActivityId || null);
    setTimelineDayIndex(dayIndex);
    setIsTimelineOpen(true);
  };

  const closeTimeline = () => {
    setIsTimelineOpen(false);
    setTimelineDayIndex(null);
    setTimelineDragging(null);
    setTimelineFocusId(null);
  };

  const applyTimelineDraftToPlan = () => {
    if (!tripPlan) return;
    if (timelineDayIndex === null) return;
    const day = tripPlan.days?.[timelineDayIndex];
    if (!day) return;

    // Normalize draft to prevent overlaps (preserve each duration, push down as needed)
    const bufferMin = 15;
    const dragStart = 6 * 60;
    const dragEnd = 23 * 60;
    const normalizedDraft = { ...timelineDraft };
    let prevEnd: number | null = null;
    for (const a of day.activities || []) {
      const id = a.client_id;
      if (!id) continue;
      const d = normalizedDraft[id];
      if (!d) continue;
      const dur = Math.max(15, d.duration || (d.end - d.start));
      let start = Math.max(dragStart, d.start);
      if (prevEnd !== null) start = Math.max(start, prevEnd + bufferMin);
      let end = start + dur;
      if (end > dragEnd) {
        end = dragEnd;
        start = Math.min(start, end);
      }
      normalizedDraft[id] = { start, end, duration: Math.max(15, end - start) };
      prevEnd = end;
    }

    const newPlan = { ...tripPlan, days: [...tripPlan.days] };
    const newDay = { ...day, activities: [...day.activities] };
    newDay.activities = newDay.activities.map((a) => {
      const id = a.client_id;
      if (!id) return a;
      const draft = normalizedDraft[id];
      if (!draft) return a;
      return {
        ...a,
        time: `${formatTime(draft.start)} - ${formatTime(draft.end)}`,
      };
    });
    newPlan.days[timelineDayIndex] = newDay;
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
    pushToast("success", language === "en" ? "Timeline updated." : "Đã cập nhật timeline.");
    closeTimeline();
  };

  const toggleTimelineLock = (activityId: string) => {
    setTimelineLocked((prev) => ({ ...prev, [activityId]: !prev[activityId] }));
  };

  const roundTo5 = useCallback(
    (mins: number) => Math.round(mins / 5) * 5,
    []
  );

  const autoAdjustTimeline = () => {
    if (!tripPlan) return;
    if (timelineDayIndex === null) return;
    const day = tripPlan.days?.[timelineDayIndex];
    if (!day) return;

    const activities = day.activities || [];
    const ids = activities.map((a) => a.client_id).filter((x): x is string => Boolean(x));
    if (ids.length === 0) return;

    const buffer = 15;
    const dragStart = 6 * 60;
    const dragEnd = 23 * 60;

    // Validate locked anchors don't overlap.
    let prevLockedEnd: number | null = null;
    for (let i = 0; i < activities.length; i++) {
      const id = activities[i].client_id;
      if (!id || !timelineLocked[id]) continue;
      const d = timelineDraft[id];
      if (!d) continue;
      if (prevLockedEnd !== null && d.start < prevLockedEnd + buffer) {
        pushToast(
          "error",
          language === "en"
            ? "Auto adjust failed: locked activities overlap."
            : "Không thể tự động điều chỉnh vì các hoạt động bị khóa đang trùng nhau."
        );
        return;
      }
      prevLockedEnd = d.end;
    }

    const clampStart = (v: number) => Math.min(dragEnd - 15, Math.max(dragStart, v));
    const clampEnd = (v: number) => Math.min(dragEnd, Math.max(dragStart + 15, v));

    // Derive a reasonable day range from current draft; then clamp to window.
    const starts = ids.map((id) => timelineDraft[id]?.start).filter((x): x is number => Number.isFinite(x));
    const ends = ids.map((id) => timelineDraft[id]?.end).filter((x): x is number => Number.isFinite(x));
    const dayStart = clampStart(starts.length ? Math.min(...starts) : 8 * 60);
    const dayEnd = clampEnd(ends.length ? Math.max(...ends) : 20 * 60);

    const nextDraft = { ...timelineDraft };

    const scheduleSegment = (
      segStart: number,
      segEnd: number,
      indices: number[],
      prevAnchor: boolean,
      nextAnchor: boolean
    ) => {
      if (indices.length === 0) return true;
      const buffers =
        (indices.length - 1) + (prevAnchor ? 1 : 0) + (nextAnchor ? 1 : 0);
      const available = segEnd - segStart - buffers * buffer;
      if (available <= 0) return false;

      const durations = indices.map((idx) => {
        const id = activities[idx].client_id;
        if (!id) return 0;
        return nextDraft[id]?.duration ?? parseTime(activities[idx].time).duration;
      });
      const total = durations.reduce((a, b) => a + b, 0);
      const rawScale = total > 0 ? available / total : 1;
      const scale = Math.min(2, Math.max(0.5, rawScale));

      let t = segStart + (prevAnchor ? buffer : 0);
      for (let k = 0; k < indices.length; k++) {
        const idx = indices[k];
        const id = activities[idx].client_id;
        if (!id) continue;
        const baseDur = durations[k] || 120;
        const dur = Math.max(15, roundTo5(baseDur * scale));
        const start = t;
        const end = t + dur;
        nextDraft[id] = { start, end, duration: dur };
        t = end;
        if (k < indices.length - 1) t += buffer;
        else if (nextAnchor) t += buffer;
      }
      return t <= segEnd;
    };

    // Segment by locked activities (in list order)
    let prevEnd = dayStart;
    let prevAnchor = false;
    let lastIndex = -1;
    for (let i = 0; i < activities.length; i++) {
      const id = activities[i].client_id;
      if (!id || !timelineLocked[id]) continue;
      const locked = nextDraft[id];
      if (!locked) continue;

      const segment = [] as number[];
      for (let j = lastIndex + 1; j < i; j++) {
        const jid = activities[j].client_id;
        if (!jid) continue;
        if (timelineLocked[jid]) continue;
        segment.push(j);
      }

      const ok = scheduleSegment(prevEnd, locked.start, segment, prevAnchor, true);
      if (!ok) {
        pushToast(
          "error",
          language === "en"
            ? "Auto adjust failed: not enough space between locked activities."
            : "Không thể tự động điều chỉnh: không đủ thời gian giữa các hoạt động bị khóa."
        );
        return;
      }

      prevEnd = locked.end;
      prevAnchor = true;
      lastIndex = i;
    }

    const tail = [] as number[];
    for (let j = lastIndex + 1; j < activities.length; j++) {
      const jid = activities[j].client_id;
      if (!jid) continue;
      if (timelineLocked[jid]) continue;
      tail.push(j);
    }
    const okTail = scheduleSegment(prevEnd, dayEnd, tail, prevAnchor, false);
    if (!okTail) {
      pushToast(
        "error",
        language === "en" ? "Auto adjust failed." : "Không thể tự động điều chỉnh."
      );
      return;
    }

    setTimelineDraft(nextDraft);
    pushToast(
      "success",
      language === "en" ? "Auto adjusted." : "Đã tự động điều chỉnh lịch trình."
    );
  };

  useEffect(() => {
    if (!timelineDragging) return;
    const pxPerMin = 2;
    const minDur = 15;
    const dragStart = 6 * 60;
    const dragEnd = 23 * 60;

    const onMove = (e: PointerEvent) => {
      const deltaY = e.clientY - timelineDragging.startY;
      const deltaMins = roundTo5(deltaY / pxPerMin);

      setTimelineDraft((prev) => {
        const current = prev[timelineDragging.activityId];
        if (!current) return prev;
        let start = timelineDragging.originStart;
        let end = timelineDragging.originEnd;

        if (timelineDragging.action === "move") {
          const duration = Math.max(minDur, end - start);
          start = start + deltaMins;
          end = start + duration;
        } else {
          if (timelineDragging.edge === "top") {
            start = Math.min(end - minDur, start + deltaMins);
          } else {
            end = Math.max(start + minDur, end + deltaMins);
          }
        }
        start = Math.max(dragStart, Math.min(dragEnd - minDur, start));
        end = Math.max(start + minDur, Math.min(dragEnd, end));
        const duration = end - start;
        return { ...prev, [timelineDragging.activityId]: { start, end, duration } };
      });
    };

    const onUp = () => {
      setTimelineDragging(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [timelineDragging, roundTo5]);

  useEffect(() => {
    if (!isTimelineOpen) return;
    if (!timelineFocusId) return;

    const t = window.setTimeout(() => {
      const el = document.getElementById(`timeline-item-${timelineFocusId}`);
      if (el) {
        try {
          el.scrollIntoView({ block: "center" });
        } catch {
          // ignore
        }
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [isTimelineOpen, timelineFocusId]);

  const handleSavePlan = async () => {
    if (!tripPlan?.trip_id) return;
    if (savingPlan) return;

    try {
      setSavingPlan(true);

      const token = await getIdToken?.();
      if (!token) {
        pushToast("error", language === "en" ? "You need to sign in to save." : "Bạn cần đăng nhập để lưu.");
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

      // Refresh from backend to ensure persisted version matches dirty snapshot.
      const refreshResp = await fetch(`/api/trip/${tripPlan.trip_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      const refreshed = await refreshResp.json().catch(() => null);
      if (refreshResp.ok && refreshed && typeof refreshed === "object") {
        const refreshedPlanRaw = (refreshed as any)?.trip_plan;
        if (refreshedPlanRaw && typeof refreshedPlanRaw === "object") {
          const nextPlan: TripPlan = ensureActivityIds({
            ...(refreshedPlanRaw as TripPlan),
            trip_id: tripPlan.trip_id,
            cover_image: (refreshed as any)?.cover_image || (refreshedPlanRaw as any)?.cover_image,
          });
          setTripPlan(nextPlan);
          localStorage.setItem("tripPlan", JSON.stringify(nextPlan));
          savedSnapshotRef.current = JSON.stringify(nextPlan);

          const nextParams = {
            destination: (refreshed as any)?.destination,
            duration: (refreshed as any)?.duration,
            budget: (refreshed as any)?.budget,
            activity_level: (refreshed as any)?.activity_level,
            travel_group: (refreshed as any)?.travel_group,
            group_size: (refreshed as any)?.group_size,
            travel_mode: (refreshed as any)?.travel_mode,
            start_date: (refreshed as any)?.start_date,
            preferences: (refreshed as any)?.preferences,
          };
          setTripParams(nextParams);
          localStorage.setItem("tripParams", JSON.stringify(nextParams));
        } else {
          savedSnapshotRef.current = JSON.stringify(tripPlan);
        }
      } else {
        savedSnapshotRef.current = JSON.stringify(tripPlan);
      }

      pushToast("success", language === "en" ? "Saved successfully." : "Đã lưu kế hoạch.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushToast("error", language === "en" ? `Save failed: ${msg}` : `Lưu thất bại: ${msg}`);
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

    const moved = arrayMove(currentActivities, oldIndex, newIndex);
    const bufferMin = 15;
    const starts = moved.map((a) => parseTime(a.time).start).filter((n) => Number.isFinite(n));
    const baseStart = starts.length ? Math.min(...starts) : 8 * 60;
    let t = baseStart;
    const normalized = moved.map((a) => {
      const p = parseTime(a.time);
      const dur = Math.max(15, p.duration);
      const start = t;
      const end = start + dur;
      t = end + bufferMin;
      return { ...a, time: `${formatTime(start)} - ${formatTime(end)}` };
    });

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: normalized,
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

    const moved = arrayMove(currentActivities, oldIndex, newIndex);
    const bufferMin = 15;
    const starts = moved.map((a) => parseTime(a.time).start).filter((n) => Number.isFinite(n));
    const baseStart = starts.length ? Math.min(...starts) : 8 * 60;
    let t = baseStart;
    const normalized = moved.map((a) => {
      const p = parseTime(a.time);
      const dur = Math.max(15, p.duration);
      const start = t;
      const end = start + dur;
      t = end + bufferMin;
      return { ...a, time: `${formatTime(start)} - ${formatTime(end)}` };
    });

    const newPlan = { ...tripPlan };
    newPlan.days = [...newPlan.days];
    newPlan.days[dayIndex] = {
      ...newPlan.days[dayIndex],
      activities: normalized,
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

  const fetchSuggestionsForActivity = async (dayIndex: number, activityIndex: number) => {
    if (!tripPlan) return;
    const activity = tripPlan.days?.[dayIndex]?.activities?.[activityIndex];
    const activityId = activity?.client_id;
    if (!activityId) return;
    if (suggestingActivityIds[activityId]) return;
    if (suggestionsByActivityId[activityId]?.length) return;

    try {
      setSuggestingActivityIds((prev) => ({ ...prev, [activityId]: true }));

      const destination = (tripParams?.destination || "").trim();
      const locationCoords = averageCoordsFromDay(tripPlan.days?.[dayIndex]);
      const placeTypeHint = isHotelLikeQuery(activity?.place || "") ? "lodging" : undefined;

      const response = await fetch("/api/trip/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          location_coords: locationCoords,
          place_type_hint: placeTypeHint,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch suggestions");
      }

      const raw = Array.isArray(data?.suggestions) ? (data.suggestions as PlaceDetails[]) : [];
      const decorated = decorateSuggestionsWithAds(activityId, raw);
      setSuggestionsByActivityId((prev) => ({ ...prev, [activityId]: decorated }));
    } catch (e) {
      console.error(e);
    } finally {
      setSuggestingActivityIds((prev) => ({ ...prev, [activityId]: false }));
    }
  };

  const handlePickSuggestion = async (
    dayIndex: number,
    activityIndex: number,
    suggestion: PlaceSuggestion
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
      place: suggestion.name || current.place,
      place_details: {
        ...(current.place_details || {}),
        ...suggestion,
      },
      _isNew: false,
    };

    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));

    // Enrich with full resolve data (description/cost/tips), using the chosen place name.
    await handleResolvePlace(dayIndex, activityIndex, suggestion.name || current.place);
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
              onClick={requestLeave}
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
            
            {/* 8 Badges in One Row - Fill Width */}
            <div className="flex flex-wrap gap-2 mb-8">
              {/* Total Cost Card - Larger */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300 shadow-sm flex-2 min-w-0">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[10px] text-blue-600 font-semibold">{language === "en" ? "Total Cost" : "Tổng chi phí"}</div>
                  <div className="font-bold text-gray-800 text-sm truncate">
                    {formatVndNumber(computedTripTotalVnd)} đ
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

                  {/* Travel Mode Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-sky-50 rounded-lg border border-sky-200 flex-1 min-w-0">
                    <TravelModeIcon mode={tripParams.travel_mode} className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-sky-600 font-medium">{language === "en" ? "Transport" : "Phương tiện"}</div>
                      <div className="font-bold text-gray-800 text-xs truncate">{formatTravelMode(tripParams.travel_mode, language)}</div>
                    </div>
                  </div>

                  {/* Members Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5 bg-amber-50 rounded-lg border border-amber-200 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 20v-1a4 4 0 00-3-3.87" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-amber-700 font-medium">{language === "en" ? "Members" : "Thành viên"}</div>
                      <div className="font-bold text-gray-800 text-xs truncate">
                        {inferGroupSize(tripParams)} {language === "en" ? "people" : "người"}
                      </div>
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
                          <div className="text-xs text-gray-500">{formatDate(weather.date)}</div>
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
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <h3 className="text-base font-bold text-gray-800">{language === "en" ? "Route" : "Lộ trình"}</h3>
                      </div>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => {
                          const idx = tripPlan.days.findIndex((d) => d.day === selectedDay);
                          if (idx >= 0) openTimeline(idx);
                        }}
                        title={
                          language === "en"
                            ? "Open day timeline"
                            : "Mở timeline theo ngày"
                        }
                      >
                        {language === "en" ? "Timeline" : "Timeline"}
                      </button>
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
                    <div className="flex flex-col items-end gap-2">
                      <div className="badge badge-outline font-bold text-blue-700 border-blue-700 whitespace-nowrap">
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
                      <div className="badge badge-outline font-bold text-red-700 border-red-700 whitespace-nowrap">
                        {language === "en"
                          ? `Total distance: ${formatKm(dayTotalDistanceKm(currentDay))}`
                          : `Tổng quãng đường: ${formatKm(dayTotalDistanceKm(currentDay))}`}
                      </div>
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
                                    onClick={() => requestDeleteActivity(dayIndex, activityIdx)}
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
                              suggestions={
                                suggestionsByActivityId[activity.client_id!] || []
                              }
                              suggestionsLoading={
                                Boolean(suggestingActivityIds[activity.client_id!])
                              }
                              existingPlaceKeys={buildExistingPlaceKeySet(currentDay.activities, activityIdx)}
                              onRequestSuggestions={() =>
                                fetchSuggestionsForActivity(dayIndex, activityIdx)
                              }
                              onPickSuggestion={(s) =>
                                handlePickSuggestion(dayIndex, activityIdx, s)
                              }
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
                              onDelete={() => requestDeleteActivity(dayIndex, activityIdx)}
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
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold">{language === "en" ? "Edit time" : "Chỉnh sửa thời gian"}</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() => {
                    openTimeline(timeEditTarget.dayIndex);
                    closeTimeEdit();
                  }}
                  title={
                    language === "en"
                      ? "Open day timeline"
                      : "Mở timeline theo ngày"
                  }
                >
                  {language === "en" ? "Timeline" : "Timeline"}
                </button>
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
                    const ok = applyTimeEdit();
                    if (ok) closeTimeEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeTimeEdit();
                  }
                }}
              />
              <div className="mb-3">
                {/* <div className="text-xs font-semibold text-gray-600 mb-2">Tự động điều chỉnh</div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="radio radio-sm"
                      checked={timeAdjustMode === "push_preserve_gaps"}
                      onChange={() => setTimeAdjustMode("push_preserve_gaps")}
                    />
                    <span>Đẩy các điểm sau (giữ khoảng trống)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="radio radio-sm"
                      checked={timeAdjustMode === "push_compact"}
                      onChange={() => setTimeAdjustMode("push_compact")}
                    />
                    <span>Đẩy các điểm sau (nén lịch, không khoảng trống)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="radio radio-sm"
                      checked={timeAdjustMode === "keep_following"}
                      onChange={() => setTimeAdjustMode("keep_following")}
                    />
                    <span>Chỉ đổi điểm này (không thay đổi các điểm sau)</span>
                  </label>
                </div> */}

                {(!isValidTimeRangeText(timeEditInput) ||
                  (timeAdjustMode === "keep_following" && (() => {
                    try {
                      const day = tripPlan?.days?.[timeEditTarget.dayIndex];
                      const activities = day?.activities || [];
                      const parsed = parseTime(timeEditInput);
                      if (timeEditTarget.activityIndex < activities.length - 1) {
                        const nextParsed = parseTime(activities[timeEditTarget.activityIndex + 1].time);
                        return nextParsed.start < parsed.end;
                      }
                      return false;
                    } catch {
                      return false;
                    }
                  })())) && (
                  <div className="mt-2 text-xs text-red-600 font-semibold">
                    {!isValidTimeRangeText(timeEditInput)
                      ? "Sai định dạng. VD: 08:00 - 10:00"
                      : "Bị trùng thời gian với hoạt động tiếp theo. Hãy chọn chế độ đẩy các điểm sau."}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const ok = applyTimeEdit();
                    if (ok) closeTimeEdit();
                  }}
                  disabled={
                    !isValidTimeRangeText(timeEditInput) ||
                    (timeAdjustMode === "keep_following" && (() => {
                      try {
                        const day = tripPlan?.days?.[timeEditTarget.dayIndex];
                        const activities = day?.activities || [];
                        const parsed = parseTime(timeEditInput);
                        if (timeEditTarget.activityIndex < activities.length - 1) {
                          const nextParsed = parseTime(activities[timeEditTarget.activityIndex + 1].time);
                          return nextParsed.start < parsed.end;
                        }
                        return false;
                      } catch {
                        return false;
                      }
                    })())
                  }
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

        {confirmLeaveOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999996]"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmLeaveOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">
                {language === "en" ? "Unsaved changes" : "Chưa lưu thay đổi"}
              </h3>
              <div className="text-sm text-gray-600">
                {language === "en"
                  ? "You have unsaved changes. Leave without saving?"
                  : "Bạn đang có thay đổi chưa lưu. Bạn có muốn thoát mà không lưu?"}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setConfirmLeaveOpen(false)}
                >
                  {language === "en" ? "Stay" : "Ở lại"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error"
                  onClick={() => {
                    setConfirmLeaveOpen(false);
                    const target = pathname.includes("/edit-plan") && tripPlan?.trip_id
                      ? `/trip/${tripPlan.trip_id}`
                      : "/";
                    router.push(target);
                  }}
                >
                  {language === "en" ? "Leave" : "Thoát"}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed top-4 right-4 z-[1000000]">
            <div
              className={`alert shadow-lg ${
                toast.type === "success"
                  ? "alert-success"
                  : toast.type === "error"
                    ? "alert-error"
                    : "alert-info"
              }`}
              role="status"
            >
              <span className="text-sm">{toast.message}</span>
            </div>
          </div>
        )}

        {confirmDeleteTarget && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999998]"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmDeleteTarget(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">
                {language === "en" ? "Delete activity" : "Xoá hoạt động"}
              </h3>
              <div className="text-sm text-gray-600">
                {language === "en"
                  ? "This action cannot be undone."
                  : "Hành động này không thể hoàn tác."}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setConfirmDeleteTarget(null)}
                >
                  {language === "en" ? "Cancel" : "Huỷ"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error"
                  onClick={performDeleteActivity}
                >
                  {language === "en" ? "Delete" : "Xoá"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isTimelineOpen && timelineDayIndex !== null && tripPlan?.days?.[timelineDayIndex] && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999997]"
            role="dialog"
            aria-modal="true"
            onClick={closeTimeline}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-5 max-w-4xl w-full mx-4 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold">
                    {language === "en"
                      ? `Timeline — Day ${tripPlan.days[timelineDayIndex].day}`
                      : `Timeline — Ngày ${tripPlan.days[timelineDayIndex].day}`}
                  </h3>
                  <div className="text-xs text-gray-600 mt-1">
                    {language === "en"
                      ? "Drag blocks to move. Drag top/bottom edge to resize."
                      : "Kéo khối để dời giờ. Kéo mép trên/dưới để đổi giờ."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={autoAdjustTimeline}
                    title={
                      language === "en"
                        ? "Auto adjust scales time blocks to fit the day and keeps locked activities fixed."
                        : "Tự động điều chỉnh sẽ co/giãn thời lượng để vừa khung ngày và giữ nguyên các hoạt động đã khóa."
                    }
                  >
                    {language === "en" ? "Auto adjust" : "Tự động điều chỉnh"}
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={applyTimelineDraftToPlan}>
                    {language === "en" ? "Save" : "Lưu"}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline btn-primary" onClick={closeTimeline}>
                    {language === "en" ? "Close" : "Đóng"}
                  </button>
                </div>
              </div>

              {(() => {
                const pxPerMin = 2;
                const windowStart = 6 * 60;
                const windowEnd = 23 * 60;
                const gridHeight = (windowEnd - windowStart) * pxPerMin;
                const day = tripPlan.days[timelineDayIndex];
                const hours = [] as number[];
                for (let h = 6; h <= 23; h++) hours.push(h);

                return (
                  <div className="border rounded-lg bg-gray-50 max-h-[65vh] overflow-y-auto">
                    <div className="flex">
                      <div className="relative w-14 flex-shrink-0">
                        <div className="relative" style={{ height: gridHeight }}>
                          {hours.map((h) => {
                            const top = (h * 60 - windowStart) * pxPerMin;
                            return (
                              <div
                                key={h}
                                className="absolute right-2 text-[11px] text-gray-500"
                                style={{ top: top - 6 }}
                              >
                                {String(h).padStart(2, "0")}:00
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="relative flex-1 border-l" style={{ height: gridHeight }}>
                        {hours.map((h) => {
                          const top = (h * 60 - windowStart) * pxPerMin;
                          return (
                            <div
                              key={`line-${h}`}
                              className="absolute left-0 right-0 border-t border-gray-200"
                              style={{ top }}
                            />
                          );
                        })}

                        {(day.activities || []).map((a, activityIndex) => {
                          const id = a.client_id;
                          if (!id) return null;
                          const draft = timelineDraft[id];
                          if (!draft) return null;

                          const top = (draft.start - windowStart) * pxPerMin;
                          const height = Math.max(30, draft.duration * pxPerMin);
                          const isLocked = Boolean(timelineLocked[id]);
                          const isFocused = timelineFocusId === id;

                          return (
                            <div
                              key={id}
                              id={`timeline-item-${id}`}
                              className={`absolute left-3 right-3 rounded-lg shadow-sm border select-none ${
                                isLocked
                                  ? "bg-gray-100 border-gray-300"
                                  : "bg-blue-50 border-blue-300"
                              } ${isFocused ? "ring-2 ring-blue-500" : ""}`}
                              style={{ top, height }}
                            >
                              <div
                                className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTimelineDragging({
                                    activityId: id,
                                    action: "resize",
                                    edge: "top",
                                    startY: e.clientY,
                                    originStart: draft.start,
                                    originEnd: draft.end,
                                  });
                                }}
                                title={
                                  language === "en"
                                    ? "Drag to change start time"
                                    : "Kéo để đổi giờ bắt đầu"
                                }
                              />

                              <div
                                className="h-full cursor-grab active:cursor-grabbing"
                                onPointerDown={(e) => {
                                  // Only drag with primary button and not from resize handles.
                                  if (e.button !== 0) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTimelineFocusId(id);
                                  setTimelineDragging({
                                    activityId: id,
                                    action: "move",
                                    startY: e.clientY,
                                    originStart: draft.start,
                                    originEnd: draft.end,
                                  });
                                }}
                              >
                                <div className="flex items-start justify-between gap-2 px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-gray-700">
                                      {formatTime(draft.start)} - {formatTime(draft.end)}
                                    </div>
                                    <div className="text-sm font-bold text-gray-900 truncate">
                                      {a.place || (language === "en" ? "Untitled" : "Chưa đặt tên")}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openTimeEditText(
                                          timelineDayIndex,
                                          activityIndex,
                                          `${formatTime(draft.start)} - ${formatTime(draft.end)}`
                                        );
                                      }}
                                      title={language === "en" ? "Edit as text" : "Sửa theo dạng text"}
                                    >
                                      {language === "en" ? "Edit" : "Sửa"}
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-xs ${isLocked ? "btn-neutral" : "btn-ghost"}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleTimelineLock(id);
                                      }}
                                      title={
                                        language === "en"
                                          ? "Lock keeps this activity fixed during Auto adjust."
                                          : "Khóa sẽ giữ nguyên hoạt động này khi Tự động điều chỉnh."
                                      }
                                    >
                                      {language === "en" ? "Lock" : "Khóa"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div
                                className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTimelineDragging({
                                    activityId: id,
                                    action: "resize",
                                    edge: "bottom",
                                    startY: e.clientY,
                                    originStart: draft.start,
                                    originEnd: draft.end,
                                  });
                                }}
                                title={
                                  language === "en"
                                    ? "Drag to change end time"
                                    : "Kéo để đổi giờ kết thúc"
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
