"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import TripCard from "../../components/TripCard";

interface PublicTrip {
  trip_id: string;
  user_id: string;
  username: string;
  destination: string;
  duration: number;
  budget: string;
  start_date: string;
  trip_name: string;
  overview: string;
  category_tags: string[];
  cover_image?: string;
  views_count: number;
  likes_count: number;
  rating: number;
  activity_level: string;
  travel_group: string;
  published_at: string;
}

const CATEGORIES = [
  "Cultural",
  "Adventure",
  "Relax",
  "Nature",
  "Food",
  "Shopping",
  "Beach",
  "Mountain",
  "City",
  "Historical",
];

export default function ExplorePage() {
  const { t } = useLanguage();
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        sort_by: sortBy,
      });

      if (selectedDuration) params.append("duration", selectedDuration);
      if (selectedBudget) params.append("budget", selectedBudget);
      if (selectedCategories.length > 0)
        params.append("category_tags", selectedCategories.join(","));
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(
        `http://localhost:8000/api/catalog/trips?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      setTrips(data.trips);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [page, selectedDuration, selectedBudget, selectedCategories, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTrips();
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
    setPage(1);
  };

  const handleViewTrip = async (tripId: string) => {
    // Increment view count
    try {
      await fetch(`http://localhost:8000/api/trip/${tripId}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "anonymous" }),
      });
    } catch (err) {
      console.error("Failed to increment view count:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">
            {t("explore_trips") || "Khám Phá Chuyến Đi"}
          </h1>
          <p className="text-lg opacity-90">
            {t("explore_description") ||
              "Tham khảo và lấy cảm hứng từ các chuyến đi của cộng đồng"}
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-6">
            <div className="relative max-w-2xl">
              <input
                type="text"
                placeholder={t("search_destination") || "Tìm điểm đến, hoạt động..."}
                className="input input-lg input-bordered w-full pr-12 text-gray-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-circle absolute right-2 top-2"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
              <h2 className="font-bold text-lg mb-4">
                {t("filters") || "Bộ Lọc"}
              </h2>

              {/* Duration Filter */}
              <div className="mb-4">
                <label className="font-semibold text-sm mb-2 block">
                  {t("duration") || "Thời gian"}
                </label>
                <select
                  className="select select-bordered w-full select-sm"
                  value={selectedDuration}
                  onChange={(e) => {
                    setSelectedDuration(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("all") || "Tất cả"}</option>
                  <option value="1">1 {t("day") || "ngày"}</option>
                  <option value="2-3">2-3 {t("days") || "ngày"}</option>
                  <option value="4-7">4-7 {t("days") || "ngày"}</option>
                  <option value="7+">7+ {t("days") || "ngày"}</option>
                </select>
              </div>

              {/* Budget Filter */}
              <div className="mb-4">
                <label className="font-semibold text-sm mb-2 block">
                  {t("budget") || "Ngân sách"}
                </label>
                <div className="flex flex-col gap-2">
                  {["low", "medium", "high"].map((budget) => (
                    <label key={budget} className="cursor-pointer flex items-center gap-2">
                      <input
                        type="radio"
                        name="budget"
                        className="radio radio-sm"
                        checked={selectedBudget === budget}
                        onChange={() => {
                          setSelectedBudget(budget);
                          setPage(1);
                        }}
                      />
                      <span className="text-sm">
                        {budget === "low"
                          ? t("low") || "Thấp"
                          : budget === "medium"
                          ? t("medium") || "Trung bình"
                          : t("high") || "Cao"}
                      </span>
                    </label>
                  ))}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setSelectedBudget("")}
                  >
                    {t("clear") || "Xóa"}
                  </button>
                </div>
              </div>

              {/* Category Tags */}
              <div className="mb-4">
                <label className="font-semibold text-sm mb-2 block">
                  {t("categories") || "Thể loại"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <label key={category} className="cursor-pointer">
                      <input
                        type="checkbox"
                        className="hidden peer"
                        checked={selectedCategories.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                      />
                      <span className="badge badge-sm peer-checked:badge-primary">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="mb-4">
                <label className="font-semibold text-sm mb-2 block">
                  {t("sort_by") || "Sắp xếp"}
                </label>
                <select
                  className="select select-bordered w-full select-sm"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="newest">{t("newest") || "Mới nhất"}</option>
                  <option value="popular">{t("popular") || "Phổ biến"}</option>
                  <option value="views">{t("most_viewed") || "Xem nhiều"}</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Results Count */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-gray-600">
                {t("found_trips") || "Tìm thấy"} <span className="font-bold">{total}</span>{" "}
                {t("trips") || "chuyến đi"}
              </p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {/* Trips Grid */}
            {!loading && !error && trips.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">
                  {t("no_trips_found") || "Không tìm thấy chuyến đi nào"}
                </p>
              </div>
            )}

            {!loading && !error && trips.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {trips.map((trip) => (
                    <TripCard
                      key={trip.trip_id}
                      trip={trip}
                      showUsername={true}
                      onView={() => handleViewTrip(trip.trip_id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    className="btn btn-outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("previous") || "Trước"}
                  </button>
                  <span className="btn btn-ghost">
                    {t("page") || "Trang"} {page}
                  </span>
                  <button
                    className="btn btn-outline"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("next") || "Tiếp"}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
