"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "vi";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    // Homepage
    "home.title": "Pocket Atlas",
    "home.subtitle": "Your AI-powered travel companion",
    "home.planTrip": "Plan your perfect trip to",
    "home.description": "Discover amazing destinations, create personalized itineraries, and explore local attractions with intelligent recommendations powered by AI.",
    "home.getStarted": "Get Started",
    "home.planTrip.button": "Plan Trip",
    "home.feature1.title": "Smart Planning",
    "home.feature1.desc": "AI-generated itineraries tailored to your preferences and budget",
    "home.feature2.title": "Local Insights",
    "home.feature2.desc": "Discover hidden gems and popular attractions with detailed information",
    "home.feature3.title": "Personalized",
    "home.feature3.desc": "Customize your trip plan interactively and adjust schedules on the fly",
    
    // Input page
    "input.title": "To get started, enter your destination",
    "input.destination": "Destination",
    "input.destination.placeholder": "Enter destination (e.g., Hanoi, Da Nang, Phu Quoc...)",
    "input.duration": "Duration (days)",
    "input.days": "days",
    "input.startDate": "Start Date",
    "input.budget": "Budget",
    "input.budget.low": "Budget",
    "input.budget.medium": "Moderate",
    "input.budget.high": "Premium",
    "input.preferences": "Preferences (optional)",
    "input.preferences.placeholder": "e.g.: culture, food, nature, adventure...",
    "input.generate": "Continue →",
    "input.generating": "Generating plan...",
    "input.error.required": "Please fill in destination and start date",
    "input.error.failed": "Unable to create travel plan",
    "input.error.generic": "An error occurred, please try again",
    
    // Plan page
    "plan.back": "← Back",
    "plan.print": "Print",
    "plan.totalCost": "Total Estimated Cost",
    "plan.packingList": "Packing List",
    "plan.travelTips": "Travel Tips",
    "plan.packingList.title": "Packing List",
    "plan.travelTips.title": "Travel Tips",
    "plan.locations": "Locations",
    "plan.day": "Day",
    "plan.done": "Done",
    "plan.openMaps": "Open in Google Maps",
    "plan.reviews": "reviews",
    "plan.dragToReorder": "Drag to reorder",
    
    // Loading screen
    "loading.analyzing": "Analyzing your preferences...",
    "loading.searching": "Searching best destinations...",
    "loading.planning": "Planning your itinerary...",
    "loading.finalizing": "Finalizing your trip...",
    "loading.subtitle": "Creating your perfect journey",
    // Explore page
    "explore_trips": "Explore Trips",
    "explore_description": "Discover trips from the community",
    "search_destination": "Search destination or activity",
    "filters": "Filters",
    "duration": "Duration",
    "all": "All",
    "day": "day",
    "days": "days",
    "budget": "Budget",
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "clear": "Clear",
    "categories": "Categories",
    "sort_by": "Sort by",
    "newest": "Newest",
    "popular": "Popular",
    "most_viewed": "Most viewed",
    "found_trips": "Found",
    "trips": "trips",
    "random_trip": "Random",
    "no_trips_found": "No trips found",
    "previous": "Previous",
    "next": "Next",
    "page": "Page",
    "activity_level": "Activity",
    "views": "views",
    "likes": "likes",
    // Category translations
    "Văn hóa": "Culture",
    "Phiêu lưu": "Adventure",
    "Thư giãn": "Relax",
    "Thiên nhiên": "Nature",
    "Ẩm thực": "Food",
    "Mua sắm": "Shopping",
    "Lịch sử": "History",
    "Giải trí đêm": "Nightlife",
    "Nhiếp ảnh": "Photography",
  },
  vi: {
    // Homepage
    "home.title": "Pocket Atlas",
    "home.subtitle": "Người bạn đồng hành du lịch thông minh",
    "home.planTrip": "Lên kế hoạch chuyến đi đến",
    "home.description": "Khám phá những điểm đến tuyệt vời, tạo hành trình cá nhân hóa và khám phá các địa điểm địa phương với gợi ý thông minh từ AI.",
    "home.getStarted": "Bắt Đầu",
    "home.planTrip.button": "Lên Kế Hoạch",
    "home.feature1.title": "Lập Kế Hoạch Thông Minh",
    "home.feature1.desc": "Hành trình do AI tạo ra, phù hợp với sở thích và ngân sách của bạn",
    "home.feature2.title": "Thông Tin Địa Phương",
    "home.feature2.desc": "Khám phá những viên ngọc ẩn và điểm tham quan nổi tiếng với thông tin chi tiết",
    "home.feature3.title": "Cá Nhân Hóa",
    "home.feature3.desc": "Tùy chỉnh kế hoạch chuyến đi và điều chỉnh lịch trình linh hoạt",
    
    // Input page
    "input.title": "Để bắt đầu, hãy nhập địa điểm",
    "input.destination": "Địa điểm",
    "input.destination.placeholder": "Nhập địa điểm (ví dụ: Hà Nội, Đà Nẵng, Phú Quốc...)",
    "input.duration": "Thời gian (ngày)",
    "input.days": "ngày",
    "input.startDate": "Ngày bắt đầu",
    "input.budget": "Ngân sách",
    "input.budget.low": "Tiết kiệm",
    "input.budget.medium": "Trung bình",
    "input.budget.high": "Cao cấp",
    "input.preferences": "Sở thích (tùy chọn)",
    "input.preferences.placeholder": "Ví dụ: văn hóa, ẩm thực, thiên nhiên, phiêu lưu...",
    "input.generate": "Tiếp tục →",
    "input.generating": "Đang tạo kế hoạch...",
    "input.error.required": "Vui lòng điền đầy đủ địa điểm và ngày bắt đầu",
    "input.error.failed": "Không thể tạo kế hoạch du lịch",
    "input.error.generic": "Đã xảy ra lỗi, vui lòng thử lại",
    
    // Plan page
    "plan.back": "← Quay lại",
    "plan.print": "In",
    "plan.totalCost": "Tổng chi phí ước tính",
    "plan.packingList": "Danh sách đồ",
    "plan.travelTips": "Lời khuyên",
    "plan.packingList.title": "Danh sách đồ cần mang",
    "plan.travelTips.title": "Lời khuyên du lịch",
    "plan.locations": "Địa điểm",
    "plan.day": "Ngày",
    "plan.done": "Xong",
    "plan.openMaps": "Mở trong Google Maps",
    "plan.reviews": "đánh giá",
    "plan.dragToReorder": "Kéo để sắp xếp lại",
    
    // Loading screen
    "loading.analyzing": "Đang phân tích sở thích của bạn...",
    "loading.searching": "Đang tìm kiếm điểm đến tốt nhất...",
    "loading.planning": "Đang lập kế hoạch hành trình...",
    "loading.finalizing": "Đang hoàn thiện chuyến đi...",
    "loading.subtitle": "Tạo hành trình hoàn hảo cho bạn",
    // Explore page
    "explore_trips": "Khám Phá Chuyến Đi",
    "explore_description": "Tham khảo các chuyến đi từ cộng đồng",
    "search_destination": "Tìm điểm đến hoặc hoạt động",
    "filters": "Bộ Lọc",
    "duration": "Thời gian",
    "all": "Tất cả",
    "day": "ngày",
    "days": "ngày",
    "budget": "Ngân sách",
    "low": "Thấp",
    "medium": "Trung bình",
    "high": "Cao",
    "clear": "Xóa",
    "categories": "Thể loại",
    "sort_by": "Sắp xếp",
    "newest": "Mới nhất",
    "popular": "Phổ biến",
    "most_viewed": "Xem nhiều",
    "found_trips": "Tìm thấy",
    "trips": "chuyến đi",
    "random_trip": "Ngẫu nhiên",
    "no_trips_found": "Không tìm thấy chuyến đi nào",
    "previous": "Trước",
    "next": "Tiếp",
    "page": "Trang",
    "activity_level": "Hoạt động",
    "views": "lượt xem",
    "likes": "yêu thích",
    // Category translations
    "Văn hóa": "Văn hóa",
    "Phiêu lưu": "Phiêu lưu",
    "Thư giãn": "Thư giãn",
    "Thiên nhiên": "Thiên nhiên",
    "Ẩm thực": "Ẩm thực",
    "Mua sắm": "Mua sắm",
    "Lịch sử": "Lịch sử",
    "Giải trí đêm": "Giải trí đêm",
    "Nhiếp ảnh": "Nhiếp ảnh",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("vi");

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "en" || saved === "vi")) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
