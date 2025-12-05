"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getIdToken } from "../../lib/firebase";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  bio: string;
  location: string;
  interests: string[];
  stats?: {
    total_trips: number;
    public_trips: number;
    total_likes: number;
    badges: string[];
    stars: number;
  };
}

interface LikedTrip {
  trip_id: string;
  destination: string;
  duration: number;
  trip_name: string;
  cover_image?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [likedTrips, setLikedTrips] = useState<LikedTrip[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  
  // Edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }

    if (user && !user.isAnonymous) {
      fetchProfile();
      fetchLikedTrips();
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const token = await getIdToken();
      const response = await fetch(`http://localhost:8000/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setDisplayName(data.displayName || user?.displayName || "");
        setBio(data.bio || "");
        setLocation(data.location || "");
        setPhotoURL(data.photoURL || user?.photoURL || "");
      } else {
        // Initialize with user data if profile doesn't exist
        const userData = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          bio: "",
          location: "",
          interests: [],
        };
        setProfile(userData);
        setDisplayName(user.displayName || "");
        setPhotoURL(user.photoURL || "");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLikedTrips = async () => {
    if (!user) return;
    
    try {
      const token = await getIdToken();
      const response = await fetch(`http://localhost:8000/api/user/liked-trips`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLikedTrips(data.trips || []);
      }
    } catch (err) {
      console.error("Failed to fetch liked trips:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaveError("");
    try {
      const token = await getIdToken();
      if (!token) {
        setSaveError(language === "en" ? "Authentication required" : "Yêu cầu xác thực");
        return;
      }

      const response = await fetch(`http://localhost:8000/api/user/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: displayName || profile?.displayName || "",
          bio: bio || "",
          location: location || "",
          photoURL: photoURL || "",
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setIsEditing(false);
        // Show success briefly
        const successMsg = language === "en" ? "Profile saved!" : "Đã lưu hồ sơ!";
        setSaveError(successMsg);
        setTimeout(() => setSaveError(""), 3000);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Save profile error:", errorData);
        setSaveError(errorData.details || errorData.error || (language === "en" ? "Failed to save" : "Không thể lưu"));
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setSaveError(language === "en" ? "Network error" : "Lỗi mạng");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-md">
        <div className="navbar-start">
          <button onClick={() => router.back()} className="btn btn-ghost">
            ← {language === "en" ? "Back" : "Quay lại"}
          </button>
        </div>
        <div className="navbar-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600">
            {language === "en" ? "My Profile" : "Hồ Sơ Của Tôi"}
          </h1>
        </div>
        <div className="navbar-end mr-4">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn btn-primary btn-sm">
              {language === "en" ? "Edit Profile" : "Chỉnh sửa"}
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-5xl">
        {/* Profile Card */}
        <div className="card bg-white shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="avatar">
                  <div className="w-32 h-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                    {(photoURL || profile?.photoURL) ? (
                      <img 
                        src={photoURL || profile?.photoURL || ''} 
                        alt="Avatar" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold w-full h-full"
                      style={{ display: (photoURL || profile?.photoURL) ? 'none' : 'flex' }}
                    >
                      {(displayName || profile?.displayName || user?.email)?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  </div>
                </div>
                {isEditing && (
                  <input
                    type="text"
                    placeholder={language === "en" ? "Avatar URL" : "URL ảnh đại diện"}
                    className="input input-bordered input-sm w-full max-w-xs"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                  />
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">
                          {language === "en" ? "Display Name" : "Tên hiển thị"}
                        </span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">
                          {language === "en" ? "Bio" : "Giới thiệu"}
                        </span>
                      </label>
                      <textarea
                        className="textarea textarea-bordered w-full"
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={language === "en" ? "Tell us about yourself..." : "Giới thiệu về bạn..."}
                      />
                    </div>
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">
                          {language === "en" ? "Location" : "Địa điểm"}
                        </span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={language === "en" ? "City, Country" : "Thành phố, Quốc gia"}
                      />
                    </div>
                    {saveError && (
                      <div className={`alert ${saveError.includes("saved") || saveError.includes("lưu") ? "alert-success" : "alert-error"} mb-2`}>
                        <span>{saveError}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} className="btn btn-primary">
                        {language === "en" ? "Save" : "Lưu"}
                      </button>
                      <button onClick={() => { setIsEditing(false); setSaveError(""); }} className="btn btn-ghost">
                        {language === "en" ? "Cancel" : "Hủy"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold">{displayName || user.email}</h2>
                    <p className="text-gray-600">{user.email}</p>
                    
                    {/* Stars Display */}
                    {profile?.stats && profile.stats.stars > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">
                          {language === "en" ? "Rating:" : "Xếp hạng:"}
                        </span>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i} 
                              className={`w-5 h-5 ${i < (profile.stats?.stars || 0) ? 'text-yellow-500' : 'text-gray-300'}`} 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Stats */}
                    {profile?.stats && (
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="font-bold text-primary">{profile.stats.total_trips}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "trips" : "chuyến đi"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-secondary">{profile.stats.public_trips}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "public" : "công khai"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-accent">{profile.stats.total_likes}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "likes" : "lượt thích"}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Badges */}
                    {profile?.stats?.badges && profile.stats.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {profile.stats.badges.map((badge) => (
                          <div key={badge} className="badge badge-lg badge-primary gap-1">
                            🏆 {badge}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {bio && <p className="text-gray-700 mt-4">{bio}</p>}
                    {location && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{location}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Liked Trips */}
        <div className="card bg-white shadow-xl">
          <div className="card-body">
            <h3 className="text-2xl font-bold mb-4">
              {language === "en" ? "Liked Trips" : "Chuyến Đi Yêu Thích"}
            </h3>
            {likedTrips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {likedTrips.map((trip) => (
                  <div
                    key={trip.trip_id}
                    className="card bg-base-100 shadow-md hover:shadow-xl cursor-pointer transition-shadow"
                    onClick={() => router.push(`/trip/explore/${trip.trip_id}?userId=${user.uid}`)}
                  >
                    {trip.cover_image && (
                      <figure className="h-48">
                        <img src={trip.cover_image} alt={trip.trip_name} className="w-full h-full object-cover" />
                      </figure>
                    )}
                    <div className="card-body p-4">
                      <h4 className="card-title text-base">{trip.trip_name || trip.destination}</h4>
                      <p className="text-sm text-gray-600">
                        {trip.duration} {language === "en" ? "days" : "ngày"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {language === "en" ? "No liked trips yet" : "Chưa có chuyến đi yêu thích"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
