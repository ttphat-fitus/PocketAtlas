"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";

interface TripCardProps {
  trip: {
    trip_id: string;
    user_id: string;
    username?: string;
    destination: string;
    duration: number;
    budget: string;
    start_date: string;
    trip_name: string;
    overview?: string;
    category_tags?: string[];
    cover_image?: string;
    views_count?: number;
    likes_count?: number;
    rating?: number;
    activity_level?: string;
    travel_group?: string;
  };
  showUsername?: boolean;
  onView?: () => void;
}

// Budget badge colors
const budgetColors: { [key: string]: string } = {
  low: "badge-success",
  medium: "badge-warning",
  high: "badge-error",
};

// Activity level badge colors
const activityColors: { [key: string]: string } = {
  low: "badge-info",
  medium: "badge-primary",
  high: "badge-secondary",
};

// Travel group icons
const travelGroupIcons: { [key: string]: string } = {
  solo: "🧳",
  couple: "💑",
  family: "👨‍👩‍👧‍👦",
  friends: "👥",
};

export default function TripCard({ trip, showUsername = true, onView }: TripCardProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const handleClick = () => {
    if (onView) onView();
    router.push(`/trip/explore/${trip.trip_id}?userId=${trip.user_id}`);
  };

  return (
    <div
      className="card bg-white shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
      onClick={handleClick}
    >
      {/* Cover Image */}
      <figure className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-500">
        {trip.cover_image ? (
          <img
            src={trip.cover_image}
            alt={trip.trip_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-6xl">
            {trip.destination.charAt(0)}
          </div>
        )}
        
        {/* Rating Badge (top-right) */}
        {trip.rating && trip.rating > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <span>⭐</span>
            <span>{trip.rating}</span>
          </div>
        )}
      </figure>

      {/* Card Body */}
      <div className="card-body p-4">
        {/* User Info */}
        {showUsername && trip.username && (
          <div className="flex items-center gap-2 mb-2">
            <div className="avatar placeholder">
              <div className="bg-primary text-white w-6 h-6 rounded-full text-xs flex items-center justify-center">
                {trip.username.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-xs text-gray-500">{trip.username}</span>
          </div>
        )}

        {/* Trip Title */}
        <h3 className="font-bold text-lg line-clamp-2 mb-2">
          {trip.trip_name || `${trip.destination} - ${trip.duration} ${t("days")}`}
        </h3>

        {/* Overview */}
        {trip.overview && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {trip.overview}
          </p>
        )}

        {/* Category Tags */}
        {trip.category_tags && trip.category_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trip.category_tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="badge badge-sm badge-outline">
                {tag}
              </span>
            ))}
            {trip.category_tags.length > 3 && (
              <span className="badge badge-sm badge-ghost">
                +{trip.category_tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Duration */}
          <div className="badge badge-lg bg-pink-100 text-pink-700 border-pink-300">
            📅 {trip.duration} {trip.duration === 1 ? t("day") : t("days")}
          </div>

          {/* Budget */}
          <div className={`badge badge-lg bg-green-100 text-green-700 border-green-300`}>
            💰 {trip.budget === "low" ? t("low") : trip.budget === "medium" ? t("medium") : t("high")}
          </div>

          {/* Activity Level */}
          {trip.activity_level && (
            <div className="badge badge-lg bg-blue-100 text-blue-700 border-blue-300">
              🏃 {trip.activity_level === "low" ? t("low") : trip.activity_level === "medium" ? t("medium") : t("high")}
            </div>
          )}
        </div>

        {/* Bottom Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
          <div className="flex items-center gap-3">
            {/* Travel Group */}
            {trip.travel_group && (
              <span className="flex items-center gap-1">
                {travelGroupIcons[trip.travel_group] || "🧳"}
                {trip.travel_group}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Views */}
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {trip.views_count || 0}
            </span>

            {/* Likes */}
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              {trip.likes_count || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
