"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";

export default function LandingPage() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { user, loading, signOut } = useAuth();

  const destinations: string[] = [
    "Hà Nội",
    "Đà Nẵng",
    "Hội An",
    "Phú Quốc",
    "Đà Lạt",
    "Nha Trang",
  ];

  const [currentDestination, setCurrentDestination] = useState(destinations[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDestination((prev) => {
        const currentIndex = destinations.indexOf(prev);
        const nextIndex = (currentIndex + 1) % destinations.length;
        return destinations[nextIndex];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [destinations]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start">
          <div className="flex items-center gap-2 ml-4">
            {/* Language Toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setLanguage("en")}
                className={`btn btn-sm ${
                  language === "en"
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600"
                    : "btn-ghost"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("vi")}
                className={`btn btn-sm ${
                  language === "vi"
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600"
                    : "btn-ghost"
                }`}
              >
                VI
              </button>
            </div>

            {/* Navigation Links */}
            <div className="divider divider-horizontal mx-1"></div>
            <a href="/explore" className="btn btn-ghost btn-sm font-semibold">
              {language === "en" ? "Explore" : "Khám phá"}
            </a>
            <a href="/blog" className="btn btn-ghost btn-sm font-semibold">
              Blog
            </a>
          </div>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {t("home.title")}
          </a>
        </div>

        <div className="navbar-end mr-4">
          {loading ? (
            <div className="loading loading-spinner loading-sm"></div>
          ) : user && !user.isAnonymous ? (
            <div className="flex items-center gap-4">
              <a href="/profile" className="btn btn-ghost btn-sm">
                {language === "en" ? "Profile" : "Hồ sơ"}
              </a>
              <a href="/trips" className="btn btn-ghost btn-sm">
                {language === "en" ? "My Trips" : "Chuyến đi"}
              </a>
              <a href="/trip/input" className="btn btn-primary btn-sm">
                {t("home.planTrip.button")}
              </a>
              <button
                onClick={() => signOut()}
                className="btn btn-ghost btn-sm"
              >
                {language === "en" ? "Sign Out" : "Đăng xuất"}
              </button>
            </div>
          ) : (
            <a href="/auth" className="btn btn-primary">
              {language === "en" ? "Get Started" : "Bắt đầu"}
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 h-screen place-items-center justify-center px-4">
        <h1 className="text-6xl font-bold w-full text-center">
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-teal-500 to-green-500">
            {t("home.title")}
          </span>
        </h1>

        <h2 className="text-xl w-full text-center text-gray-600 mt-4">
          {t("home.subtitle")}
        </h2>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-gray-500">{t("home.planTrip")}</span>
          <div className="badge badge-lg badge-primary font-semibold text-lg px-4 py-3">
            {currentDestination}
          </div>
        </div>

        <h2 className="text-base w-full text-center mt-6 max-w-2xl text-gray-600">
          {t("home.description")}
        </h2>

        <a href="/trip/input" className="mt-8">
          <button className="btn btn-primary btn-lg rounded-full px-8 text-lg">
            {t("home.getStarted")}
          </button>
        </a>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <h3 className="card-title text-lg">{t("home.feature1.title")}</h3>
              <p className="text-sm text-gray-600">{t("home.feature1.desc")}</p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">📍</div>
              <h3 className="card-title text-lg">{t("home.feature2.title")}</h3>
              <p className="text-sm text-gray-600">{t("home.feature2.desc")}</p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <div className="text-4xl mb-2">✨</div>
              <h3 className="card-title text-lg">{t("home.feature3.title")}</h3>
              <p className="text-sm text-gray-600">{t("home.feature3.desc")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
