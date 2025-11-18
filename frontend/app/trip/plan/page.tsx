"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  activity: Activity;
  activityIdx: number;
  dayIndex: number;
  isEditing: boolean;
  onEdit: (field: keyof Activity, value: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onDelete: () => void;
}

function SortableActivity({
  activity,
  activityIdx,
  dayIndex,
  isEditing,
  onEdit,
  onStartEdit,
  onFinishEdit,
  onDelete,
}: SortableActivityProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${dayIndex}-${activityIdx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card bg-white shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div className="flex gap-3 flex-1">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-move flex items-start pt-2 text-gray-400 hover:text-gray-600"
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

            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  className="input input-bordered input-sm w-48 mb-2"
                  value={activity.time}
                  onChange={(e) => onEdit("time", e.target.value)}
                />
              ) : (
                <div className="badge badge-outline mb-2">
                  ⏰ {activity.time}
                </div>
              )}

              {isEditing ? (
                <input
                  type="text"
                  className="input input-bordered w-full mb-2"
                  value={activity.place}
                  onChange={(e) => onEdit("place", e.target.value)}
                />
              ) : (
                <h3 className="text-xl font-bold mb-2">
                  📍 {activity.place}
                </h3>
              )}

              {activity.place_details?.address && (
                <div className="mb-2">
                  <div className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-blue-600 mt-0.5">📍</span>
                    <p className="text-sm text-gray-700 flex-1">
                      {activity.place_details.address}
                    </p>
                  </div>
                  {activity.place_details.lat !== 0 && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${activity.place_details.lat},${activity.place_details.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      🗺️ Mở trong Google Maps
                    </a>
                  )}
                </div>
              )}

              {activity.place_details && activity.place_details.rating > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="badge badge-warning">
                    ⭐ {activity.place_details.rating.toFixed(1)}
                  </div>
                  <span className="text-xs text-gray-500">
                    ({activity.place_details.total_ratings} đánh giá)
                  </span>
                </div>
              )}

              {isEditing ? (
                <textarea
                  className="textarea textarea-bordered w-full mb-2"
                  value={activity.description}
                  onChange={(e) => onEdit("description", e.target.value)}
                />
              ) : (
                <p className="text-gray-700 mb-3">{activity.description}</p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {isEditing ? (
                  <input
                    type="text"
                    className="input input-bordered input-sm"
                    value={activity.estimated_cost}
                    onChange={(e) => onEdit("estimated_cost", e.target.value)}
                  />
                ) : (
                  <div className="badge badge-success">
                    💰 {activity.estimated_cost}
                  </div>
                )}
              </div>

              {activity.tips && (
                <div className="alert alert-info py-2">
                  <span className="text-sm">
                    💡 <strong>Tips:</strong>{" "}
                    {isEditing ? (
                      <input
                        type="text"
                        className="input input-bordered input-sm w-full mt-1"
                        value={activity.tips}
                        onChange={(e) => onEdit("tips", e.target.value)}
                      />
                    ) : (
                      activity.tips
                    )}
                  </span>
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
              <button
                className="btn btn-success btn-sm"
                onClick={onFinishEdit}
              >
                ✓ Xong
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={onStartEdit}>
                ✏️
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm text-error"
              onClick={onDelete}
            >
              🗑️
            </button>
            {activity.place_details?.lat !== 0 && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${activity.place_details?.lat},${activity.place_details?.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                🗺️
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TripPlanPage() {
  const router = useRouter();
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripParams, setTripParams] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [editingActivity, setEditingActivity] = useState<{
    dayIndex: number;
    activityIndex: number;
  } | null>(null);
  const [showPackingList, setShowPackingList] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const storedPlan = localStorage.getItem("tripPlan");
    const storedParams = localStorage.getItem("tripParams");

    if (storedPlan) {
      setTripPlan(JSON.parse(storedPlan));
    } else {
      router.push("/trip/input");
    }

    if (storedParams) {
      setTripParams(JSON.parse(storedParams));
    }
  }, [router]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !tripPlan) return;

    const dayIndex = tripPlan.days.findIndex((d) => d.day === selectedDay);
    if (dayIndex === -1) return;

    const oldIndex = parseInt((active.id as string).split("-")[1]);
    const newIndex = parseInt((over.id as string).split("-")[1]);

    const newPlan = { ...tripPlan };
    const originalActivities = [...newPlan.days[dayIndex].activities];
    const reorderedActivities = arrayMove(
      newPlan.days[dayIndex].activities,
      oldIndex,
      newIndex
    );

    // Recalculate times after reordering - preserve gaps from original order
    newPlan.days[dayIndex].activities = recalculateActivityTimes(
      reorderedActivities,
      true // preserve gaps
    );
    
    setTripPlan(newPlan);
    localStorage.setItem("tripPlan", JSON.stringify(newPlan));
  };

  const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
    if (!tripPlan) return;

    const newPlan = { ...tripPlan };
    newPlan.days[dayIndex].activities.splice(activityIndex, 1);
    
    // Recalculate times after deletion - don't preserve gaps to close the schedule
    if (newPlan.days[dayIndex].activities.length > 0) {
      newPlan.days[dayIndex].activities = recalculateActivityTimes(
        newPlan.days[dayIndex].activities,
        false // no gap preservation on delete
      );
    }
    
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
    (newPlan.days[dayIndex].activities[activityIndex][field] as string) = value;
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
            onClick={() => router.push("/trip/input")}
            className="btn btn-ghost"
          >
            ← Quay lại
          </button>
        </div>
        <div className="navbar-center">
          <span className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {tripPlan.trip_name}
          </span>
        </div>
        <div className="navbar-end">
          <button className="btn btn-ghost" onClick={() => window.print()}>
            🖨️ In
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Card */}
        <div className="card bg-white shadow-xl mb-8">
          <div className="card-body">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{tripPlan.trip_name}</h2>
                <p className="text-gray-600 mb-4">{tripPlan.overview}</p>
                <div className="flex flex-wrap gap-2">
                  {tripParams && (
                    <>
                      <div className="badge badge-primary badge-lg">
                        📍 {tripParams.destination}
                      </div>
                      <div className="badge badge-secondary badge-lg">
                        ⏰ {tripParams.duration} ngày
                      </div>
                      <div className="badge badge-accent badge-lg">
                        📅 {new Date(tripParams.start_date).toLocaleDateString("vi-VN")}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="stats shadow">
                  <div className="stat">
                    <div className="stat-title">Tổng chi phí ước tính</div>
                    <div className="stat-value text-2xl text-primary">
                      {tripPlan.total_estimated_cost}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowPackingList(!showPackingList)}
                  >
                    🎒 Danh sách đồ
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowTips(!showTips)}
                  >
                    💡 Lời khuyên
                  </button>
                </div>
              </div>
            </div>

            {/* Packing List Modal */}
            {showPackingList && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-bold text-lg mb-2">
                  🎒 Danh sách đồ cần mang
                </h3>
                <ul className="list-disc list-inside grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tripPlan.packing_list.map((item, idx) => (
                    <li key={idx} className="text-gray-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Travel Tips Modal */}
            {showTips && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h3 className="font-bold text-lg mb-2">💡 Lời khuyên du lịch</h3>
                <ul className="list-disc list-inside space-y-2">
                  {tripPlan.travel_tips.map((tip, idx) => (
                    <li key={idx} className="text-gray-700">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Day Selector Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-white shadow-lg sticky top-24">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">Địa điểm</h3>
                <div className="space-y-2">
                  {tripPlan.days.map((day) => (
                    <button
                      key={day.day}
                      onClick={() => setSelectedDay(day.day)}
                      className={`btn w-full justify-start ${
                        selectedDay === day.day
                          ? "btn-primary"
                          : "btn-ghost btn-outline"
                      }`}
                    >
                      <span className="font-bold">Ngày {day.day}:</span>
                      <span className="truncate ml-2 text-sm">
                        {day.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card bg-white shadow-lg mt-4">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">Thời gian</h3>
                <p className="text-sm text-gray-600">
                  Nhập thời gian
                </p>
                <button className="btn btn-primary btn-sm mt-2">
                  Quay lại
                </button>
              </div>
            </div>
          </div>

          {/* Activities Content */}
          <div className="lg:col-span-3">
            {currentDay && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">
                    Ngày {currentDay.day}: {currentDay.title}
                  </h2>
                  <div className="divider"></div>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={currentDay.activities.map((_, idx) => {
                      const dayIndex = tripPlan.days.findIndex(
                        (d) => d.day === selectedDay
                      );
                      return `${dayIndex}-${idx}`;
                    })}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-6">
                      {currentDay.activities.map((activity, activityIdx) => {
                        const dayIndex = tripPlan.days.findIndex(
                          (d) => d.day === selectedDay
                        );
                        const isEditing =
                          editingActivity?.dayIndex === dayIndex &&
                          editingActivity?.activityIndex === activityIdx;

                        return (
                          <SortableActivity
                            key={`${dayIndex}-${activityIdx}`}
                            activity={activity}
                            activityIdx={activityIdx}
                            dayIndex={dayIndex}
                            isEditing={isEditing}
                            onEdit={(field, value) =>
                              handleEditActivity(dayIndex, activityIdx, field, value)
                            }
                            onStartEdit={() =>
                              setEditingActivity({ dayIndex, activityIndex: activityIdx })
                            }
                            onFinishEdit={() => setEditingActivity(null)}
                            onDelete={() => handleDeleteActivity(dayIndex, activityIdx)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
