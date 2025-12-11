"use client";

import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getIdToken } from "../../lib/firebase";

// Badge icon SVG mapper with emoji fallback (EXCEPTION CASE for badges only)
const BadgeIcon = ({ icon, className = "w-8 h-8", showEmojiFallback = false }: { icon: string; className?: string; showEmojiFallback?: boolean }) => {
  // Emoji fallback mapping (ONLY for badge display, exceptional case)
  const emojiMap: { [key: string]: string } = {
    compass: "🧭",
    backpack: "🎒",
    rocket: "🚀",
    star: "⭐",
    map: "🗺️",
    fire: "🔥",
    globe: "🌍",
    pen: "✍️"
  };
  
  const icons: { [key: string]: ReactElement } = {
    compass: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
    ),
    backpack: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
      </svg>
    ),
    rocket: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
      </svg>
    ),
    star: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
    map: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
      </svg>
    ),
    fire: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
      </svg>
    ),
    globe: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
      </svg>
    ),
    pen: (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    ),
  };
  
  // If emoji fallback requested and icon exists in emoji map, show emoji
  if (showEmojiFallback && emojiMap[icon]) {
    return <span className="text-3xl">{emojiMap[icon]}</span>;
  }
  
  // Otherwise return SVG
  return icons[icon] || icons.star;
};

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
      const token = await getIdToken();
      const response = await fetch(`/api/profile/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
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
      const token = await getIdToken();
      const response = await fetch(`/api/profile/rewards`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
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
      const response = await fetch("/api/profile/redeem-reward", {
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
      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const profileData = data.profile || data;
        
        // Ensure we have all the data with proper fallbacks
        const completeProfile = {
          uid: profileData.uid || user.uid,
          email: profileData.email || user.email || "",
          displayName: profileData.username || profileData.displayName || user?.displayName || "",
          photoURL: profileData.photo_url || profileData.photoURL || user?.photoURL || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          interests: profileData.interests || [],
        };
        
        setProfile(completeProfile);
        setDisplayName(completeProfile.displayName);
        setBio(completeProfile.bio);
        setLocation(completeProfile.location);
        setPhotoURL(completeProfile.photoURL);
        
        // Cache to localStorage for faster reload
        localStorage.setItem(`profile_${user.uid}`, JSON.stringify(completeProfile));
      } else {
        // Try to load from localStorage if API fails
        const cached = localStorage.getItem(`profile_${user.uid}`);
        if (cached) {
          const cachedProfile = JSON.parse(cached);
          setProfile(cachedProfile);
          setDisplayName(cachedProfile.displayName);
          setBio(cachedProfile.bio);
          setLocation(cachedProfile.location);
          setPhotoURL(cachedProfile.photoURL);
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
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      // Try to load from localStorage
      const cached = localStorage.getItem(`profile_${user.uid}`);
      if (cached) {
        const cachedProfile = JSON.parse(cached);
        setProfile(cachedProfile);
        setDisplayName(cachedProfile.displayName);
        setBio(cachedProfile.bio);
        setLocation(cachedProfile.location);
        setPhotoURL(cachedProfile.photoURL);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLikedTrips = async () => {
    if (!user) return;
    
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/profile/liked-trips`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLikedTrips(data.liked_trips || []);
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

      const response = await fetch(`/api/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: displayName || profile?.displayName || "",
          bio: bio || "",
          location: location || "",
          photo_url: photoURL || "",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          const updatedProfile = {
            uid: data.profile.uid || user.uid,
            email: data.profile.email || user.email || "",
            displayName: data.profile.username || displayName || "",
            photoURL: data.profile.photo_url || photoURL || "",
            bio: data.profile.bio || bio || "",
            location: data.profile.location || location || "",
            interests: [],
          };
          setProfile(updatedProfile);
          setDisplayName(updatedProfile.displayName);
          setPhotoURL(updatedProfile.photoURL);
          setBio(updatedProfile.bio);
          setLocation(updatedProfile.location);
          
          // Save to localStorage
          localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updatedProfile));
        }
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
          <button 
            onClick={() => router.push("/trips")} 
            className="btn btn-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none hover:from-blue-600 hover:to-purple-700 shadow-lg gap-2"
          >
            {/* <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg> */}
            {language === "en" ? "My Trips" : "Chuyến đi"}
          </button>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-5xl">
        {/* Profile Card */}
        <div className="card bg-white shadow-xl mb-6">
          <div className="card-body relative">
            {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn btn-primary btn-sm absolute top-4 right-4" // Thêm absolute top-4 right-4
            >
              {language === "en" ? "Edit Profile" : "Chỉnh sửa"}
            </button>
          )}
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
                    
                    {/* Stats - Also show from profile data if userStats not available */}
                    {(userStats || profile) && (
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {userStats?.trips_count ?? profile?.stats?.total_trips ?? 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {language === "en" ? "Trips" : "Chuyến đi"}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {userStats?.public_trips ?? profile?.stats?.public_trips ?? 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {language === "en" ? "Public" : "Công khai"}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-pink-50 rounded-lg">
                          <div className="text-2xl font-bold text-pink-600">
                            {userStats?.total_likes ?? profile?.stats?.total_likes ?? 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {language === "en" ? "Likes" : "Yêu thích"}
                          </div>
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
                    {badges.filter(b => b.earned).map((badge) => {
                      const colorMap: { [key: string]: string } = {
                        'bg-blue-500': 'text-blue-600 bg-blue-100 border-blue-300',
                        'bg-green-500': 'text-green-600 bg-green-100 border-green-300',
                        'bg-purple-500': 'text-purple-600 bg-purple-100 border-purple-300',
                        'bg-pink-500': 'text-pink-600 bg-pink-100 border-pink-300',
                        'bg-yellow-500': 'text-yellow-600 bg-yellow-100 border-yellow-300',
                        'bg-red-500': 'text-red-600 bg-red-100 border-red-300',
                        'bg-indigo-500': 'text-indigo-600 bg-indigo-100 border-indigo-300',
                        'bg-orange-500': 'text-orange-600 bg-orange-100 border-orange-300',
                      };
                      const badgeStyle = colorMap[badge.color] || 'text-gray-600 bg-gray-100 border-gray-300';
                      return (
                        <div 
                          key={badge.id} 
                          className={`${badgeStyle} border-2 px-4 py-2 rounded-full flex items-center gap-2 shadow-md`}
                          title={language === "en" ? badge.description : badge.description_vi}
                        >
                          <BadgeIcon icon={badge.icon} className="w-5 h-5" />
                          <span className="font-semibold">{language === "en" ? badge.name : badge.name_vi}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Featured Liked Trips */}
            <div className="card bg-gradient-to-br from-purple-50 to-pink-50 shadow-xl border-2 border-purple-200">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {language === "en" ? "Featured Liked Trips" : "Chuyến Đi Yêu Thích Nổi Bật"}
                  </h3>
                </div>
                {likedTrips.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {likedTrips.map((trip) => (
                      <div
                        key={trip.trip_id}
                        className="card bg-white shadow-lg hover:shadow-2xl cursor-pointer transition-all transform hover:-translate-y-1 duration-200 border border-purple-100"
                        onClick={() => router.push(`/trip/explore/${trip.trip_id}?userId=${user?.uid}`)}
                      >
                        {trip.cover_image && (
                          <figure className="h-48 relative overflow-hidden">
                            <img src={trip.cover_image} alt={trip.trip_name} className="w-full h-full object-cover" />
                            {/* <div className="absolute top-2 right-2">
                              <div className="badge badge-error gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div> */}
                          </figure>
                        )}
                        <div className="card-body p-4">
                          <h4 className="card-title text-base font-bold">{trip.trip_name || trip.destination}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {trip.duration} {language === "en" ? "days" : "ngày"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">
                      {language === "en" ? "No liked trips yet" : "Chưa có chuyến đi yêu thích"}
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      {language === "en" ? "Explore trips and save your favorites!" : "Khám phá các chuyến đi và lưu yêu thích!"}
                    </p>
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
                        <BadgeIcon icon={badge.icon} className="w-8 h-8 text-white" />
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
