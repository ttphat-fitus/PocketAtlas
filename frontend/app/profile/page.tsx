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

interface Badge {
  id: string;
  name: string;
  name_vi: string;
  description: string;
  description_vi: string;
  icon: string;
  color: string;
  earned: boolean;
  progress: number;
}

interface UserStats {
  trips_count: number;
  public_trips: number;
  total_views: number;
  total_likes: number;
  blogs_count: number;
  total_stars: number;
}

interface UserLevel {
  level: number;
  name: string;
  name_vi: string;
  points: number;
}

interface Reward {
  id: string;
  name: string;
  name_vi: string;
  cost: number;
  icon: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [likedTrips, setLikedTrips] = useState<LikedTrip[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [levelProgress, setLevelProgress] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([]);
  const [totalStars, setTotalStars] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "rewards">("overview");
  
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
      fetchBadgesAndStats();
      fetchRewards();
    }
  }, [user, authLoading]);

  const fetchBadgesAndStats = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/user/${user.uid}/stats`);
      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
        setUserStats(data.stats || null);
        setUserLevel(data.level || null);
        setLevelProgress(data.next_level_progress || 0);
      }
    } catch (err) {
      console.error("Failed to fetch badges:", err);
    }
  };

  const fetchRewards = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/user/${user.uid}/rewards`);
      if (response.ok) {
        const data = await response.json();
        setRewards(data.available_rewards || []);
        setRedeemedRewards(data.redeemed_rewards || []);
        setTotalStars(data.total_stars || 0);
      }
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
    }
  };

  const handleRedeemReward = async (rewardId: string) => {
    if (!user) return;
    
    try {
      const token = await getIdToken();
      const response = await fetch(`http://localhost:8000/api/user/redeem-reward`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reward_id: rewardId }),
      });
      
      if (response.ok) {
        fetchRewards();
        fetchBadgesAndStats();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to redeem reward");
      }
    } catch (err) {
      console.error("Failed to redeem reward:", err);
    }
  };

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
        <div className="navbar-end mr-4 flex gap-2">
          <button onClick={() => router.push("/trips")} className="btn btn-ghost btn-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {language === "en" ? "My Trips" : "Chuyến đi"}
          </button>
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
                    {userStats && (
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="font-bold text-blue-600">{userStats.trips_count}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "trips" : "chuyến đi"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-green-600">{userStats.public_trips}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "public" : "công khai"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-pink-600">{userStats.total_likes}</span>
                          <span className="text-gray-600 ml-1">{language === "en" ? "likes" : "lượt thích"}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Badges */}
                    {badges.filter(b => b.earned).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {badges.filter(b => b.earned).slice(0, 3).map((badge) => (
                          <div key={badge.id} className="badge badge-lg badge-primary gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {language === "en" ? badge.name : badge.name_vi}
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
        {/* Level Progress Bar */}
        {userLevel && (
          <div className="card bg-white shadow-xl mb-6">
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                    {userLevel.level}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{language === "en" ? userLevel.name : userLevel.name_vi}</h3>
                    <p className="text-sm text-gray-500">{userLevel.points} {language === "en" ? "points" : "điểm"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-2xl font-bold text-yellow-600">{totalStars}</span>
                  </div>
                  <p className="text-xs text-gray-500">{language === "en" ? "Stars earned" : "Sao đã nhận"}</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${levelProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {levelProgress}% {language === "en" ? "to next level" : "đến cấp tiếp theo"}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-white shadow-md mb-6 p-1">
          <button 
            className={`tab flex-1 ${activeTab === "overview" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            {language === "en" ? "Overview" : "Tổng quan"}
          </button>
          <button 
            className={`tab flex-1 gap-1 ${activeTab === "badges" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("badges")}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {language === "en" ? "Badges" : "Huy hiệu"}
          </button>
          <button 
            className={`tab flex-1 gap-1 ${activeTab === "rewards" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("rewards")}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
              <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
            </svg>
            {language === "en" ? "Rewards" : "Phần thưởng"}
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Stats Cards */}
            {userStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card bg-white shadow-lg">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{userStats.trips_count}</div>
                    <div className="text-sm text-gray-500">{language === "en" ? "Total Trips" : "Tổng chuyến đi"}</div>
                  </div>
                </div>
                <div className="card bg-white shadow-lg">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{userStats.public_trips}</div>
                    <div className="text-sm text-gray-500">{language === "en" ? "Public" : "Công khai"}</div>
                  </div>
                </div>
                <div className="card bg-white shadow-lg">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold text-pink-600">{userStats.total_likes}</div>
                    <div className="text-sm text-gray-500">{language === "en" ? "Likes" : "Lượt thích"}</div>
                  </div>
                </div>
                <div className="card bg-white shadow-lg">
                  <div className="card-body p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600">{userStats.blogs_count}</div>
                    <div className="text-sm text-gray-500">{language === "en" ? "Blogs" : "Bài viết"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Earned Badges Preview */}
            {badges.filter(b => b.earned).length > 0 && (
              <div className="card bg-white shadow-xl mb-6">
                <div className="card-body">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {language === "en" ? "Earned Badges" : "Huy hiệu đã đạt"}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {badges.filter(b => b.earned).map((badge) => (
                      <div 
                        key={badge.id} 
                        className={`${badge.color} text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-md`}
                        title={language === "en" ? badge.description : badge.description_vi}
                      >
                        <span className="font-semibold">{language === "en" ? badge.name : badge.name_vi}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                        onClick={() => router.push(`/trip/explore/${trip.trip_id}?userId=${user?.uid}`)}
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
          </>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="card bg-white shadow-xl">
            <div className="card-body">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {language === "en" ? "All Badges" : "Tất cả huy hiệu"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {badges.map((badge) => (
                  <div 
                    key={badge.id} 
                    className={`p-4 rounded-xl border-2 ${
                      badge.earned 
                        ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-xl ${badge.color} flex items-center justify-center shadow-lg`}>
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg">{language === "en" ? badge.name : badge.name_vi}</h4>
                          {badge.earned && (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {language === "en" ? badge.description : badge.description_vi}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`${badge.color} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${badge.progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{Math.round(badge.progress)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === "rewards" && (
          <div className="card bg-white shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
                    <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
                  </svg>
                  {language === "en" ? "Rewards Shop" : "Cửa hàng phần thưởng"}
                </h3>
                <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xl font-bold text-yellow-700">{totalStars}</span>
                  <span className="text-sm text-yellow-600">{language === "en" ? "stars" : "sao"}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rewards.map((reward) => {
                  const isRedeemed = redeemedRewards.includes(reward.id);
                  const canAfford = totalStars >= reward.cost;
                  
                  return (
                    <div 
                      key={reward.id}
                      className={`p-4 rounded-xl border-2 ${
                        isRedeemed 
                          ? 'border-green-300 bg-green-50' 
                          : canAfford 
                            ? 'border-purple-300 bg-purple-50' 
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
                            <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg">{language === "en" ? reward.name : reward.name_vi}</h4>
                          <div className="flex items-center gap-1 text-yellow-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="font-bold">{reward.cost}</span>
                          </div>
                        </div>
                        {isRedeemed ? (
                          <div className="badge badge-success gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {language === "en" ? "Owned" : "Đã đổi"}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRedeemReward(reward.id)}
                            disabled={!canAfford}
                            className={`btn btn-sm ${canAfford ? 'btn-primary' : 'btn-disabled'}`}
                          >
                            {language === "en" ? "Redeem" : "Đổi"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* How to earn stars */}
              <div className="mt-8 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {language === "en" ? "How to earn stars" : "Cách kiếm sao"}
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                    </svg>
                    {language === "en" ? "Make trips public to earn stars" : "Công khai chuyến đi để nhận sao"}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {language === "en" ? "High-rated trips earn bonus stars" : "Chuyến đi được đánh giá cao nhận thêm sao"}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                    {language === "en" ? "Write blog posts to earn more" : "Viết bài blog để kiếm thêm"}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
