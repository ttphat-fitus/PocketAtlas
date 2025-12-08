"""Catalog router for public trips"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Optional

from core.database import db

router = APIRouter()


@router.get("/api/catalog/trips")
async def get_catalog_trips(
    page: int = 1,
    limit: int = 12,
    duration: Optional[str] = None,
    budget: Optional[str] = None,
    category_tags: Optional[str] = None,
    sort_by: str = "newest",
    search: Optional[str] = None
):
    """Get all public trips for the catalog with filters"""
    try:
        # Query all public trips from the trips collection
        query = db.collection("trips").where("is_public", "==", True)
        
        if budget:
            query = query.where("budget", "==", budget)
        
        trips = query.stream()
        trips_list = []
        
        for trip in trips:
            trip_data = trip.to_dict()
            
            # Apply additional filters
            if duration:
                if duration == "1" and trip_data.get("duration") != 1:
                    continue
                elif duration == "2-3" and trip_data.get("duration") not in [2, 3]:
                    continue
                elif duration == "4-7" and not (4 <= trip_data.get("duration", 0) <= 7):
                    continue
                elif duration == "7+" and trip_data.get("duration", 0) <= 7:
                    continue
            
            if category_tags:
                tag_mapping = {
                    "Văn hóa": ["Văn hóa", "culture"],
                    "Phiêu lưu": ["Phiêu lưu", "adventure"],
                    "Thư giãn": ["Thư giãn", "relaxation", "relax"],
                    "Thiên nhiên": ["Thiên nhiên", "nature"],
                    "Ẩm thực": ["Ẩm thực", "food"],
                    "Mua sắm": ["Mua sắm", "shopping"],
                    "Lịch sử": ["Lịch sử", "history"],
                    "Giải trí đêm": ["Giải trí đêm", "nightlife"],
                    "Nhiếp ảnh": ["Nhiếp ảnh", "photography"],
                }
                tags = [t.strip() for t in category_tags.split(",")]
                trip_tags = trip_data.get("category_tags", [])
                expanded_tags = []
                for tag in tags:
                    if tag in tag_mapping:
                        expanded_tags.extend(tag_mapping[tag])
                    else:
                        expanded_tags.append(tag)
                trip_tags_lower = [t.lower() for t in trip_tags]
                expanded_tags_lower = [t.lower() for t in expanded_tags]
                if not any(t in trip_tags_lower for t in expanded_tags_lower):
                    continue
            
            if search:
                search_lower = search.lower()
                destination = trip_data.get("destination", "").lower()
                trip_name = trip_data.get("trip_plan", {}).get("trip_name", "").lower()
                if search_lower not in destination and search_lower not in trip_name:
                    continue
            
            # Get user info
            user_id = trip_data.get("user_id")
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            
            trips_list.append({
                "trip_id": trip.id,
                "user_id": user_id,
                "username": user_data.get("username", "Anonymous"),
                "photo_url": user_data.get("photo_url", ""),
                "destination": trip_data.get("destination"),
                "duration": trip_data.get("duration"),
                "budget": trip_data.get("budget"),
                "start_date": trip_data.get("start_date"),
                "trip_name": trip_data.get("trip_plan", {}).get("trip_name", ""),
                "overview": trip_data.get("trip_plan", {}).get("overview", ""),
                "category_tags": trip_data.get("category_tags", []),
                "cover_image": trip_data.get("cover_image"),
                "views_count": trip_data.get("views_count", 0),
                "likes_count": trip_data.get("likes_count", 0),
                "rating": trip_data.get("rating") if trip_data.get("rating") and trip_data.get("rating") > 0 else None,
                "published_at": trip_data.get("published_at", trip_data.get("created_at")),
                "activity_level": trip_data.get("activity_level", "medium"),
                "travel_group": trip_data.get("travel_group", "solo"),
            })
        
        # Sort trips
        if sort_by == "newest":
            trips_list.sort(key=lambda x: x.get("published_at", ""), reverse=True)
        elif sort_by == "popular":
            trips_list.sort(key=lambda x: (x.get("likes_count", 0), x.get("views_count", 0)), reverse=True)
        elif sort_by == "views":
            trips_list.sort(key=lambda x: x.get("views_count", 0), reverse=True)
        
        # Pagination
        total = len(trips_list)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_trips = trips_list[start_idx:end_idx]
        
        return JSONResponse(content={
            "trips": paginated_trips,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": end_idx < total
        })
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch catalog trips", "details": str(e)})


@router.get("/api/public-trip/{trip_id}")
async def get_public_trip(trip_id: str):
    """Get a specific public trip"""
    try:
        trip_doc = db.collection("trips").document(trip_id).get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        
        if not trip_data.get("is_public"):
            return JSONResponse(status_code=403, content={"error": "This trip is not public"})
        
        # Get user info
        user_id = trip_data.get("user_id")
        user_doc = db.collection("users").document(user_id).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        trip_data["username"] = user_data.get("username", "Anonymous")
        trip_data["user_photo"] = user_data.get("photo_url", "")
        
        return JSONResponse(content=trip_data)
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch public trip", "details": str(e)})
