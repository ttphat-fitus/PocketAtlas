"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TripInputPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    destination: "",
    duration: 3,
    budget: "medium",
    start_date: "",
    preferences: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.destination || !formData.start_date) {
      setError("Vui lòng điền đầy đủ địa điểm và ngày bắt đầu");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/plan-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Không thể tạo kế hoạch du lịch");
      }

      const tripPlan = await response.json();
      
      // Lưu trip plan vào localStorage để truyền sang trang kế tiếp
      localStorage.setItem("tripPlan", JSON.stringify(tripPlan));
      localStorage.setItem("tripParams", JSON.stringify(formData));
      
      // Chuyển sang trang hiển thị kế hoạch
      router.push("/trip/plan");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi, vui lòng thử lại"
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
            ← Back
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            Pocket Atlas
          </a>
        </div>

        <div className="navbar-end" />
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Để bắt đầu, hãy nhập địa điểm
          </h1>
          <p className="text-gray-600">
            Nhập địa điểm
          </p>
        </div>

        <div className="card bg-white shadow-xl">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Địa điểm */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    Địa điểm 📍
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập địa điểm (ví dụ: Hà Nội, Đà Nẵng, Phú Quốc...)"
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
                    Thời gian ⏰
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
                    {formData.duration} ngày
                  </div>
                </div>
              </div>

              {/* Ngày bắt đầu */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    Ngày bắt đầu 📅
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
                    Ngân sách 💰
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
                    💵 Tiết kiệm
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
                    💳 Trung bình
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
                    💎 Cao cấp
                  </button>
                </div>
              </div>

              {/* Sở thích */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-lg">
                    Sở thích (Tùy chọn) ✨
                  </span>
                </label>
                <textarea
                  placeholder="Ví dụ: Thích ẩm thực, văn hóa, thiên nhiên, chụp ảnh..."
                  className="textarea textarea-bordered h-24"
                  value={formData.preferences}
                  onChange={(e) =>
                    setFormData({ ...formData, preferences: e.target.value })
                  }
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>⚠️ {error}</span>
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
                      Đang tạo kế hoạch...
                    </>
                  ) : (
                    <>Tiếp tục →</>
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
