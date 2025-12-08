"""Gamification service for badges, achievements, and user levels"""
from core.database import db


# Badge definitions (removed emojis as per requirement)
BADGES = {
    "explorer": {
        "id": "explorer",
        "name": "Explorer",
        "name_vi": "Nhà thám hiểm",
        "description": "Created 20+ trips",
        "description_vi": "Tạo hơn 20 chuyến đi",
        "icon": "compass",
        "color": "bg-blue-500",
        "requirement": {"type": "trips_count", "value": 20}
    },
    "adventurer": {
        "id": "adventurer",
        "name": "Adventurer",
        "name_vi": "Nhà phiêu lưu",
        "description": "Created 10+ trips",
        "description_vi": "Tạo hơn 10 chuyến đi",
        "icon": "backpack",
        "color": "bg-green-500",
        "requirement": {"type": "trips_count", "value": 10}
    },
    "first_trip": {
        "id": "first_trip",
        "name": "First Steps",
        "name_vi": "Bước đầu tiên",
        "description": "Created your first trip",
        "description_vi": "Tạo chuyến đi đầu tiên",
        "icon": "rocket",
        "color": "bg-purple-500",
        "requirement": {"type": "trips_count", "value": 1}
    },
    "top_reviewer": {
        "id": "top_reviewer",
        "name": "Top Reviewer",
        "name_vi": "Người đánh giá hàng đầu",
        "description": "Gave 50+ ratings",
        "description_vi": "Đánh giá hơn 50 lần",
        "icon": "star",
        "color": "bg-yellow-500",
        "requirement": {"type": "ratings_given", "value": 50}
    },
    "local_guide": {
        "id": "local_guide",
        "name": "Local Guide",
        "name_vi": "Hướng dẫn viên địa phương",
        "description": "Tips liked 100+ times",
        "description_vi": "Tips được thích hơn 100 lần",
        "icon": "map",
        "color": "bg-teal-500",
        "requirement": {"type": "tips_likes", "value": 100}
    },
    "popular": {
        "id": "popular",
        "name": "Popular Creator",
        "name_vi": "Người sáng tạo nổi tiếng",
        "description": "Trips viewed 1000+ times",
        "description_vi": "Chuyến đi được xem hơn 1000 lần",
        "icon": "fire",
        "color": "bg-orange-500",
        "requirement": {"type": "total_views", "value": 1000}
    },
    "sharing_is_caring": {
        "id": "sharing_is_caring",
        "name": "Sharing is Caring",
        "name_vi": "Chia sẻ là quan tâm",
        "description": "Made 5+ trips public",
        "description_vi": "Công khai hơn 5 chuyến đi",
        "icon": "globe",
        "color": "bg-indigo-500",
        "requirement": {"type": "public_trips", "value": 5}
    },
    "blogger": {
        "id": "blogger",
        "name": "Travel Blogger",
        "name_vi": "Blogger du lịch",
        "description": "Wrote 5+ blog posts",
        "description_vi": "Viết hơn 5 bài blog",
        "icon": "pen",
        "color": "bg-pink-500",
        "requirement": {"type": "blogs_count", "value": 5}
    }
}


def calculate_user_stats(user_id: str) -> dict:
    """Calculate all stats for a user to determine badges"""
    stats = {
        "trips_count": 0,
        "public_trips": 0,
        "total_views": 0,
        "total_likes": 0,
        "ratings_given": 0,
        "tips_likes": 0,
        "blogs_count": 0,
        "total_stars": 0,
    }
    
    try:
        # Count trips
        trips_ref = db.collection("trips").where("user_id", "==", user_id)
        trips = list(trips_ref.stream())
        stats["trips_count"] = len(trips)
        
        for trip in trips:
            trip_data = trip.to_dict()
            if trip_data.get("is_public"):
                stats["public_trips"] += 1
                stats["total_views"] += trip_data.get("views_count", 0)
                stats["total_likes"] += trip_data.get("likes_count", 0)
                trip_rating = trip_data.get("rating", 0)
                if trip_rating >= 4:
                    stats["total_stars"] += 2
                elif trip_rating >= 3:
                    stats["total_stars"] += 1
        
        # Count blogs
        blogs_ref = db.collection("blogs").where("user_id", "==", user_id).where("is_published", "==", True)
        blogs = list(blogs_ref.stream())
        stats["blogs_count"] = len(blogs)
        
        stats["tips_likes"] = stats["total_likes"]
        
    except Exception as e:
        print(f"Error calculating user stats: {e}")
    
    return stats


def get_user_badges(user_id: str) -> list:
    """Get all badges a user has earned"""
    stats = calculate_user_stats(user_id)
    earned_badges = []
    
    for badge_id, badge in BADGES.items():
        req = badge["requirement"]
        if req["type"] in stats:
            if stats[req["type"]] >= req["value"]:
                earned_badges.append({
                    **badge,
                    "earned": True,
                    "progress": min(100, (stats[req["type"]] / req["value"]) * 100)
                })
            else:
                earned_badges.append({
                    **badge,
                    "earned": False,
                    "progress": (stats[req["type"]] / req["value"]) * 100
                })
    
    return earned_badges


def calculate_user_level(stats: dict) -> dict:
    """Calculate user level based on activity"""
    total_points = (
        stats.get("trips_count", 0) * 10 +
        stats.get("public_trips", 0) * 20 +
        stats.get("total_likes", 0) * 5 +
        stats.get("blogs_count", 0) * 30 +
        stats.get("total_stars", 0) * 10
    )
    
    levels = [
        {"level": 1, "name": "Beginner", "name_vi": "Người mới", "min_points": 0},
        {"level": 2, "name": "Traveler", "name_vi": "Du khách", "min_points": 50},
        {"level": 3, "name": "Explorer", "name_vi": "Nhà thám hiểm", "min_points": 150},
        {"level": 4, "name": "Adventurer", "name_vi": "Nhà phiêu lưu", "min_points": 400},
        {"level": 5, "name": "Expert", "name_vi": "Chuyên gia", "min_points": 800},
        {"level": 6, "name": "Master", "name_vi": "Bậc thầy", "min_points": 1500},
        {"level": 7, "name": "Legend", "name_vi": "Huyền thoại", "min_points": 3000},
    ]
    
    current_level = levels[0]
    for level in levels:
        if total_points >= level["min_points"]:
            current_level = level
    
    return {**current_level, "points": total_points}


def calculate_level_progress(stats: dict) -> int:
    """Calculate progress to next level (0-100)"""
    level_info = calculate_user_level(stats)
    total_points = level_info["points"]
    
    levels_points = [0, 50, 150, 400, 800, 1500, 3000]
    current_idx = 0
    
    for i, points in enumerate(levels_points):
        if total_points >= points:
            current_idx = i
    
    if current_idx >= len(levels_points) - 1:
        return 100
    
    current_min = levels_points[current_idx]
    next_min = levels_points[current_idx + 1]
    
    progress = ((total_points - current_min) / (next_min - current_min)) * 100
    return min(100, int(progress))
