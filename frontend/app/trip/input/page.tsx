"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import LoadingScreen from "../../../components/LoadingScreen";

export default function TripInputPage() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { user, loading: authLoading, signInAnon, getIdToken } = useAuth();
  const [formData, setFormData] = useState({
    destination: "",
    duration: 3,
    budget: "medium",
    start_date: "",
    preferences: "",
    activity_level: "medium",
    travel_group: "solo",
    categories: [] as string[],
    active_time_start: 9,
    active_time_end: 21,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");

  // Auto sign-in anonymously if not authenticated
  useEffect(() => {
    const handleAuth = async () => {
      if (!authLoading && !user) {
        try {
          await signInAnon();
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
          router.push("/auth");
        }
      }
    };
    handleAuth();
  }, [user, authLoading, router, signInAnon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.destination || !formData.start_date) {
      setError(t("input.error.required"));
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);

    // Simulate progress during generation
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 3 + 1;
      });
    }, 200);

    try {
      // Get Firebase ID token
      setLoadingProgress(10);
      const token = await getIdToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      setLoadingProgress(30);
      const response = await fetch("http://localhost:8000/api/plan-trip", {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });
      
      setLoadingProgress(80);

      if (!response.ok) {
        throw new Error(t("input.error.failed"));
      }

      const tripPlan = await response.json();
      
      setLoadingProgress(95);
      
      // Save trip plan to localStorage as fallback
      localStorage.setItem("tripPlan", JSON.stringify(tripPlan));
      localStorage.setItem("tripParams", JSON.stringify(formData));
      
      setLoadingProgress(100);
      
      // Small delay to show 100% before navigation
      setTimeout(() => {
        router.push("/trip/plan");
      }, 500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("input.error.generic")
      );
    } finally {
      clearInterval(progressInterval);
      if (!error) {
        setLoadingProgress(100);
      } else {
        setIsLoading(false);
        setLoadingProgress(0);
      }
    }
  };

  return (
    <>
      {isLoading && <LoadingScreen progress={loadingProgress} />}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start">
          <a href="/" className="btn btn-ghost text-xl">
            {t("plan.back")}
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {t("home.title")}
          </a>
        </div>

        <div className="navbar-end">
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {t("input.title")}
          </h1>
        </div>

        <div className="card bg-white shadow-xl">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Địa điểm */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    {t("input.destination")}
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={t("input.destination.placeholder")}
                  className="input input-bordered w-full"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                />
              </div>

              {/* Thời gian */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    {t("input.duration")}
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={formData.duration}
                    className="range range-primary flex-1"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration: parseInt(e.target.value),
                      })
                    }
                  />
                  <div className="badge badge-primary badge-lg px-4 py-3 whitespace-nowrap">
                    {formData.duration} {t("input.days")}
                  </div>
                </div>
              </div>

              {/* Ngày bắt đầu */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    {t("input.startDate")}
                  </span>
                </label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Ngân sách */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {t("input.budget")}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "Choose your budget level for accommodations, meals, and activities" : "Chọn mức ngân sách cho chỗ ở, bữa ăn và hoạt động"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    className={`btn ${
                      formData.budget === "low"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => setFormData({ ...formData, budget: "low" })}
                  >
                    {t("input.budget.low")}
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      formData.budget === "medium"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() =>
                      setFormData({ ...formData, budget: "medium" })
                    }
                  >
                    {t("input.budget.medium")}
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      formData.budget === "high"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => setFormData({ ...formData, budget: "high" })}
                  >
                    {t("input.budget.high")}
                  </button>
                </div>
              </div>

              {/* Physical Activity Level */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {language === "en" ? "Physical Activity" : "Mức độ hoạt động"}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "How physically active do you want your trip to be?" : "Mức độ hoạt động thể chất trong chuyến đi của bạn?"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    className={`btn ${
                      formData.activity_level === "low"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => setFormData({ ...formData, activity_level: "low" })}
                  >
                    {language === "en" ? "Low" : "Thấp"}
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      formData.activity_level === "medium"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() =>
                      setFormData({ ...formData, activity_level: "medium" })
                    }
                  >
                    {language === "en" ? "Medium" : "Trung bình"}
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      formData.activity_level === "high"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => setFormData({ ...formData, activity_level: "high" })}
                  >
                    {language === "en" ? "High" : "Cao"}
                  </button>
                </div>
              </div>

              {/* Travel Group */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {language === "en" ? "Travel Group" : "Nhóm du lịch"}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "Who are you traveling with?" : "Bạn đi du lịch cùng ai?"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.travel_group}
                  onChange={(e) => setFormData({ ...formData, travel_group: e.target.value })}
                >
                  <option value="solo">{language === "en" ? "Solo traveler" : "Một mình"}</option>
                  <option value="couple">{language === "en" ? "Couple" : "Cặp đôi"}</option>
                  <option value="family">{language === "en" ? "Family" : "Gia đình"}</option>
                  <option value="friends">{language === "en" ? "Friends" : "Bạn bè"}</option>
                </select>
              </div>

              {/* Categories */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {language === "en" ? "Categories" : "Danh mục"}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "Select your interests and preferred activities" : "Chọn sở thích và hoạt động yêu thích của bạn"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "Văn hóa", label: language === "en" ? "Culture" : "Văn hóa" },
                    { value: "Thiên nhiên", label: language === "en" ? "Nature" : "Thiên nhiên" },
                    { value: "Ẩm thực", label: language === "en" ? "Food" : "Ẩm thực" },
                    { value: "Phiêu lưu", label: language === "en" ? "Adventure" : "Phiêu lưu" },
                    { value: "Mua sắm", label: language === "en" ? "Shopping" : "Mua sắm" },
                    { value: "Giải trí đêm", label: language === "en" ? "Nightlife" : "Giải trí đêm" },
                    { value: "Thư giãn", label: language === "en" ? "Relaxation" : "Thư giãn" },
                    { value: "Lịch sử", label: language === "en" ? "History" : "Lịch sử" },
                    { value: "Nhiếp ảnh", label: language === "en" ? "Photography" : "Nhiếp ảnh" },
                  ].map((cat) => (
                    <label key={cat.value} className="label cursor-pointer justify-start gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={formData.categories.includes(cat.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              categories: [...formData.categories, cat.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              categories: formData.categories.filter((c) => c !== cat.value),
                            });
                          }
                        }}
                      />
                      <span className="label-text">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Daily Active Time - Temporarily Hidden */}
              <div className="form-control hidden">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {language === "en" ? "Daily Active Time" : "Thời gian hoạt động hàng ngày"}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "Set your preferred daily activity hours" : "Đặt giờ hoạt động hàng ngày ưa thích"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  {/* Header with time display */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      {language === "en" ? "Your active time" : "Thời gian hoạt động"}
                    </div>
                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span>{String(formData.active_time_start).padStart(2, '0')}:00 - {String(formData.active_time_end).padStart(2, '0')}:00</span>
                    </div>
                  </div>
                  
                  {/* Visual time bar */}
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between text-xs text-gray-500">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>24:00</span>
                    </div>
                    <div className="relative h-2 bg-gray-200 rounded-full">
                      <div 
                        className="absolute h-2 bg-blue-400 rounded-full"
                        style={{
                          left: `${(formData.active_time_start / 24) * 100}%`,
                          width: `${((formData.active_time_end - formData.active_time_start) / 24) * 100}%`
                        }}
                      />
                      {/* Start thumb */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md"
                        style={{
                          left: `${(formData.active_time_start / 24) * 100}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                      {/* End thumb */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md"
                        style={{
                          left: `${(formData.active_time_end / 24) * 100}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sở thích */}
              <div className="form-control flex flex-col">
                <label className="label">
                  <span className="label-text font-semibold text-lg flex items-center gap-2">
                    {t("input.preferences")}
                    <div className="tooltip tooltip-right" data-tip={language === "en" ? "Tell us about your specific interests and requirements" : "Cho chúng tôi biết về sở thích và yêu cầu cụ thể của bạn"}>
                      <div className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center cursor-help">?</div>
                    </div>
                  </span>
                </label>
                <textarea
                  placeholder={t("input.preferences.placeholder")}
                  className="textarea textarea-bordered h-28 mt-4 w-full"
                  value={formData.preferences}
                  onChange={(e) =>
                    setFormData({ ...formData, preferences: e.target.value })
                  }
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div className="form-control mt-8">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      {t("input.generating")}
                    </>
                  ) : (
                    <>{t("input.generate")}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Quay lại</span>
            <button
              onClick={() => router.push("/")}
              className="link link-primary"
            >
              Trang chủ
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
