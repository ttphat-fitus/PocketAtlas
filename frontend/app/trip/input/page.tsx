"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";

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
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.destination || !formData.start_date) {
      setError(t("input.error.required"));
      return;
    }

    setIsLoading(true);

    try {
      // Get Firebase ID token
      const token = await getIdToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://localhost:8000/api/plan-trip", {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(t("input.error.failed"));
      }

      const tripPlan = await response.json();
      
      // Save trip plan to localStorage as fallback
      localStorage.setItem("tripPlan", JSON.stringify(tripPlan));
      localStorage.setItem("tripParams", JSON.stringify(formData));
      
      // Navigate to plan page
      router.push("/trip/plan");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("input.error.generic")
      );
    } finally {
      setIsLoading(false);
    }
  };

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
            {t("home.title")}
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
                    className="range range-primary"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration: parseInt(e.target.value),
                      })
                    }
                  />
                  <div className="badge badge-primary badge-lg px-4 py-3">
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
                  <span className="label-text font-semibold text-lg">
                    {t("input.budget")}
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

              {/* Sở thích */}
              <div className="form-control flex flex-col">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    {t("input.preferences")}
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
  );
}
