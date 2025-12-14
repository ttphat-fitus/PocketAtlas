"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  "Văn hóa",
  "Phiêu lưu",
  "Thư giãn",
  "Thiên nhiên",
  "Ẩm thực",
  "Mua sắm",
  "Lịch sử",
  "Giải trí đêm",
  "Nhiếp ảnh",
];

export default function ExplorePage() {
  const { t } = useLanguage();
  const { setLanguage, language } = useLanguage();
  const router = useRouter();
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

      const response = await fetch(`/api/explore?${params}`);

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

  const handleRandomTrip = async () => {
    try {
      setLoading(true);
      // fetch a larger list of trips matching current filters
      const params = new URLSearchParams({ page: "1", limit: "100", sort_by: sortBy });
      if (selectedDuration) params.append("duration", selectedDuration);
      if (selectedBudget) params.append("budget", selectedBudget);
      if (selectedCategories.length > 0) params.append("category_tags", selectedCategories.join(","));
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/explore?${params}`);
      if (!res.ok) throw new Error("Failed to fetch trips");
      const data = await res.json();
      const list: PublicTrip[] = data.trips || [];
      if (!list || list.length === 0) {
        setError(t("no_trips_found") || "No trip found");
        return;
      }
      const pick = list[Math.floor(Math.random() * list.length)];
      router.push(`/trip/explore/${pick.trip_id}?userId=${pick.user_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No trip found");
    } finally {
      setLoading(false);
    }
  };

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
      await fetch(`/api/trip/${tripId}/view`, {
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
      {/* Navbar */}
      <div className="navbar bg-white shadow-md sticky top-0 z-50">
        <div className="navbar-start">
          <button
            onClick={() => router.push("/")}
            className="btn btn-ghost btn-sm ml-2 gap-2"
          >
            {/* <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg> */}
            {language === "en" ? "Back" : "← Quay lại"}
          </button>
        </div>
        <div className="navbar-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600">
            {t("explore_trips") || "Khám Phá"}
          </h1>
        </div>
        <div className="navbar-end mr-4">
        </div>
      </div>

      {/* Header with Optimized Search Bar */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-16 shadow-lg">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-5xl font-bold mb-3 text-center">
            {t("explore_trips") || "Khám Phá Chuyến Đi"}
          </h1>
          <p className="text-lg opacity-95 text-center mb-8">
            {t("explore_description") ||
              "Tham khảo các chuyến đi từ cộng đồng"}
          </p>

          {/* Prominent Search Bar */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder={t("search_destination") || "Tìm điểm đến hoặc hoạt động..."}
                className="input input-lg w-full pr-32 text-gray-900 shadow-2xl border-0 focus:ring-4 focus:ring-white/30 rounded-2xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                <button
                  onClick={handleRandomTrip}
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm text-gray-600 hover:bg-purple-100"
                  title={t("random_trip") || "Ngẫu nhiên"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-circle btn-sm shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
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
            </div>
          </form>

          {/* Stats */}
          <div className="flex justify-center gap-8 text-sm opacity-90">
            <div className="text-center">
              <div className="font-bold text-2xl">{total}</div>
              <div>{language === "en" ? "Trips" : "Chuyến đi"}</div>
            </div>
          </div>
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
                        {language === "en" ? t(category) || category : category}
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
