"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  const handleDeleteActivity = (dayIndex: number, activityIndex: number) => {
    if (!tripPlan) return;

    const newPlan = { ...tripPlan };
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

                <div className="space-y-6">
                  {currentDay.activities.map((activity, activityIdx) => {
                    const dayIndex = tripPlan.days.findIndex(
                      (d) => d.day === selectedDay
                    );
                    const isEditing =
                      editingActivity?.dayIndex === dayIndex &&
                      editingActivity?.activityIndex === activityIdx;

                    return (
                      <div
                        key={activityIdx}
                        className="card bg-white shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <div className="card-body">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="input input-bordered input-sm w-32 mb-2"
                                  value={activity.time}
                                  onChange={(e) =>
                                    handleEditActivity(
                                      dayIndex,
                                      activityIdx,
                                      "time",
                                      e.target.value
                                    )
                                  }
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
                                  onChange={(e) =>
                                    handleEditActivity(
                                      dayIndex,
                                      activityIdx,
                                      "place",
                                      e.target.value
                                    )
                                  }
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
                                  onChange={(e) =>
                                    handleEditActivity(
                                      dayIndex,
                                      activityIdx,
                                      "description",
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                <p className="text-gray-700 mb-3">
                                  {activity.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2 mb-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="input input-bordered input-sm"
                                    value={activity.estimated_cost}
                                    onChange={(e) =>
                                      handleEditActivity(
                                        dayIndex,
                                        activityIdx,
                                        "estimated_cost",
                                        e.target.value
                                      )
                                    }
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
                                        onChange={(e) =>
                                          handleEditActivity(
                                            dayIndex,
                                            activityIdx,
                                            "tips",
                                            e.target.value
                                          )
                                        }
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

                            <div className="flex flex-col gap-2 ml-4">
                              {isEditing ? (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => setEditingActivity(null)}
                                >
                                  ✓ Xong
                                </button>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setEditingActivity({ dayIndex, activityIndex: activityIdx })
                                  }
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                className="btn btn-ghost btn-sm text-error"
                                onClick={() =>
                                  handleDeleteActivity(dayIndex, activityIdx)
                                }
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
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
