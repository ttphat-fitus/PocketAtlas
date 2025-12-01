"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "../contexts/LanguageContext";

interface TripCardProps {
  trip: {
    trip_id: string;
    user_id: string;
    username?: string;
    photoURL?: string;
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

// Travel group SVG icons
const getTravelGroupIcon = (group: string) => {
  const iconClass = "w-4 h-4";
  switch(group) {
    case "solo":
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case "couple":
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
    case "family":
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    case "friends":
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    default:
      return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
  }
};

export default function TripCard({ trip, showUsername = true, onView }: TripCardProps) {
  const router = useRouter();
  const { t, language } = useLanguage();

  // Map English tags to Vietnamese for display consistency
  const translateTag = (tag: string): string => {
    const tagMap: { [key: string]: string } = {
      // English to Vietnamese mapping
      'culture': 'Văn hóa',
      'adventure': 'Phiêu lưu',
      'relaxation': 'Thư giãn',
      'relax': 'Thư giãn',
      'nature': 'Thiên nhiên',
      'food': 'Ẩm thực',
      'shopping': 'Mua sắm',
      'history': 'Lịch sử',
      'nightlife': 'Giải trí đêm',
      'photography': 'Nhiếp ảnh',
    };
    const lowerTag = tag.toLowerCase();
    // If we have a mapping, use it (for Vietnamese mode) or return translated version
    if (tagMap[lowerTag]) {
      return language === 'en' ? (t(tagMap[lowerTag]) || tag) : tagMap[lowerTag];
    }
    // If already Vietnamese or unknown, try translation or return as-is
    return t(tag) || tag;
  };

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
        
        {/* Rating Badge (top-right) - Only show if rating > 0 */}
        {trip.rating && Number(trip.rating) > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{trip.rating}</span>
          </div>
        )}
      </figure>

      {/* Card Body */}
      <div className="card-body p-4">
        {/* User Info */}
        {showUsername && trip.username && (
          <div className="flex items-center gap-2 mb-2">
            <div className="avatar">
              <div className="w-6 h-6 rounded-full overflow-hidden">
                {trip.photoURL ? (
                  <img 
                    src={trip.photoURL} 
                    alt={trip.username}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="bg-primary text-white w-full h-full flex items-center justify-center text-xs"
                  style={{ display: trip.photoURL ? 'none' : 'flex' }}
                >
                  {trip.username.charAt(0).toUpperCase()}
                </div>
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
                {translateTag(tag)}
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
          <div className="badge badge-lg bg-pink-100 text-pink-700 border-pink-300 gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {trip.duration} {trip.duration === 1 ? t("day") : t("days")}
          </div>

          {/* Budget */}
          <div className={`badge badge-lg bg-green-100 text-green-700 border-green-300 gap-1`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {trip.budget === "low" ? t("low") : trip.budget === "medium" ? t("medium") : t("high")}
          </div>

          {/* Activity Level */}
          {trip.activity_level && (
            <div className="badge badge-lg bg-purple-100 text-purple-700 border-purple-300 gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {trip.activity_level === "low" ? t("low") : trip.activity_level === "medium" ? t("medium") : t("high")}
            </div>
          )}
        </div>

        {/* Bottom Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
          <div className="flex items-center gap-3">
            {/* Travel Group */}
            {trip.travel_group && (
              <span className="flex items-center gap-1">
                {getTravelGroupIcon(trip.travel_group)}
                <span className="capitalize">{trip.travel_group}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Views - Only show if > 0 */}
            {(trip.views_count || 0) > 0 && (
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
                {trip.views_count}
              </span>
            )}

            {/* Likes - Only show if > 0 */}
            {(trip.likes_count || 0) > 0 && (
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
                {trip.likes_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
