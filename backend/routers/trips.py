"""Trip management router"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from datetime import datetime
import json
import re
import time
import asyncio

from firebase import get_current_user, get_optional_user
from core.database import db, firestore
from core.config import model
from models.trip import (TripRequest, RatingRequest, ViewRequest, 
                         CoverImageRequest, TogglePublicRequest, LikeRequest, UpdateTripPlanRequest)
from services.ai import create_trip_planning_prompt
from services.maps import async_geocode, enrich_activities_parallel, generate_booking_link
from services.schedule import apply_time_buffers, cap_activities_per_day
from services.weather import get_weather_forecast_async
from services.image import get_unsplash_image_async
from services.podcast import podcast_service

router = APIRouter()


def _normalize_compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _is_travel_placeholder_activity(activity: dict) -> bool:
    """Detect AI-generated travel-only rows like 'Di chuyển'."""
    try:
        place = _normalize_compact_text(str(activity.get("place", "")))
        if not place:
            return False

        # Vietnamese placeholders
        if place == "di chuyển" or place.startswith("di chuyển "):
            return True
        if place == "di chuyen" or place.startswith("di chuyen "):
            return True

        # Common English placeholders
        if place in {"travel", "transit", "commute", "move"}:
            return True
    except Exception:
        return False

    return False


def sanitize_trip_plan(trip_plan: dict) -> dict:
    """Remove travel-only placeholder activities from a plan."""
    if not isinstance(trip_plan, dict):
        return trip_plan
    days = trip_plan.get("days")
    if not isinstance(days, list):
        return trip_plan

    for day in days:
        if not isinstance(day, dict):
            continue
        activities = day.get("activities")
        if not isinstance(activities, list) or not activities:
            continue
        day["activities"] = [
            a for a in activities
            if isinstance(a, dict) and not _is_travel_placeholder_activity(a)
        ]

    return trip_plan


@router.post("/api/plan-trip")
async def plan_trip(trip_request: TripRequest, user = Depends(get_optional_user)):
    try:
        start_time = time.time()
        print(f"Trip Planning for: {trip_request.destination}")
        print(f"Duration: {trip_request.duration} days | Budget: {trip_request.budget}")
        
        trip_prompt = create_trip_planning_prompt(trip_request)
        
        print("[INFO] Gemini processing...")
        response = await model.generate_content_async(trip_prompt)
        raw_text = response.text.strip()
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        
        if not match:
            print("[ERROR] JSON not found in response")
            return JSONResponse(
                status_code=500,
                content={"error": "JSON not found in response", "raw": raw_text[:500]}
            )
        
        json_str = match.group(1) or match.group(2)
        trip_plan = json.loads(json_str)

        try:
            trip_plan = sanitize_trip_plan(trip_plan)
        except Exception as e:
            print(f"[WARN] Could not sanitize trip plan: {e}")

        # Cap activities/day before any scheduling adjustments.
        try:
            trip_plan = cap_activities_per_day(trip_plan, max_per_day=8)
        except Exception as e:
            print(f"[WARN] Could not cap activities per day: {e}")

        # Enforce buffer time between consecutive activities (deterministic post-process)
        try:
            trip_plan = apply_time_buffers(
                trip_plan,
                active_time_start=getattr(trip_request, "active_time_start", None),
                active_time_end=getattr(trip_request, "active_time_end", None),
                travel_mode=getattr(trip_request, "travel_mode", None),
            )
        except Exception as e:
            print(f"[WARN] Could not apply time buffers: {e}")
        
        # Get destination weather forecast with score and warning level
        destination_weather = []
        weather_info = {}
        forecasts = []
        try:
            from datetime import timedelta
            start_date = datetime.strptime(trip_request.start_date, "%Y-%m-%d").date()
            today = datetime.now().date()
            days_until_trip = (start_date - today).days
            
            if 0 <= days_until_trip <= 3:  # Only fetch weather for trips within 3 days
                location_coords = await async_geocode(trip_request.destination)
                
                if location_coords.get("lat"):
                    weather_data = await get_weather_forecast_async(
                        location_coords["lat"], 
                        location_coords["lng"], 
                        trip_request.duration  # Get weather for full trip duration
                    )
                    forecasts = weather_data.get("forecasts", [])
                    weather_info = {
                        "forecasts": forecasts
                    }
                    print(f"[OK] Weather API returned {len(forecasts)} days of forecast")
            else:
                print(f"[WARN] Trip starts in {days_until_trip} days - beyond 3-day weather forecast range")
            
            if forecasts:
                for i in range(min(trip_request.duration, len(forecasts))):
                    trip_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
                    if i < len(forecasts):
                        fc = forecasts[i]
                        destination_weather.append({
                            "day": i + 1,
                            "date": fc.get("date", trip_date),
                            "temp_max": fc.get("temp_max", 0),
                            "temp_min": fc.get("temp_min", 0),
                            "condition": fc.get("condition", ""),
                            "rain_chance": fc.get("rain_chance", 0),
                            "humidity": fc.get("humidity", 0),
                            "is_rainy": fc.get("is_rainy", False),
                            "is_sunny": fc.get("is_sunny", False)
                        })
                
                print(f"[OK] Weather forecast added for {len(destination_weather)} days")
        except Exception as e:
            print(f"[ERROR] Could not fetch destination weather: {e}")
        
        trip_plan["weather_forecast"] = destination_weather
        
        print("[INFO] Enriching activities with Google Places...")
        trip_plan = await enrich_activities_parallel(
            trip_plan, 
            trip_request.destination, 
            batch_size=5
        )
        
        total_activities = sum(len(day.get("activities", [])) for day in trip_plan.get("days", []))
        print(f"[SUCCESS] Trip plan generated with {total_activities} activities!")
        
        # Save trip if user is authenticated
        trip_id = None
        if user:
            trip_id = f"{user['uid']}_{int(datetime.now().timestamp())}"
            
            # print("[INFO] Fetching Unsplash cover image...")
            cover_image_url = await get_unsplash_image_async(trip_request.destination)
            
            trip_data = {
                "id": trip_id,
                "user_id": user['uid'],
                "is_anonymous": user.get('is_anonymous', False),
                "destination": trip_request.destination,
                "duration": trip_request.duration,
                "budget": trip_request.budget,
                "start_date": trip_request.start_date,
                "preferences": trip_request.preferences,
                "activity_level": trip_request.activity_level,
                "travel_group": trip_request.travel_group,
                "group_size": trip_request.group_size,
                "travel_mode": trip_request.travel_mode,
                "categories": trip_request.categories,
                "active_time_start": trip_request.active_time_start,
                "active_time_end": trip_request.active_time_end,
                "trip_plan": trip_plan,
                "weather": weather_info,
                "created_at": datetime.now().isoformat(),
                "rating": 0,
                "is_public": False,
                "views_count": 0,
                "likes_count": 0,
                "category_tags": trip_request.categories or [],
                "cover_image": cover_image_url,
            }
            
            db.collection("trips").document(trip_id).set(trip_data)
            print(f"[OK] Trip saved: {trip_id}")
            
            trip_plan["trip_id"] = trip_id
            trip_plan["cover_image"] = cover_image_url
        
        elapsed = time.time() - start_time
        print(f"[SUCCESS] Trip Planning completed in {elapsed:.2f} seconds")
        
        return JSONResponse(content=trip_plan)
    
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parsing error: {e}")
        return JSONResponse(status_code=500, content={"error": "Lỗi parse JSON từ AI", "details": str(e)})
    
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return JSONResponse(status_code=500, content={"error": "Lỗi máy chủ", "details": str(e)})


@router.get("/api/my-trips")
async def get_my_trips(user = Depends(get_current_user)):
    """Get all trips for authenticated user"""
    try:
        trips_ref = db.collection("trips").where("user_id", "==", user['uid'])
        trips = trips_ref.stream()
        
        trips_list = []
        for trip in trips:
            trip_data = trip.to_dict()
            trip_dict = {
                "trip_id": trip.id,
                "trip_name": trip_data.get("trip_name", ""),
                "destination": trip_data.get("destination"),
                "duration": trip_data.get("duration"),
                "budget": trip_data.get("budget"),
                "start_date": trip_data.get("start_date"),
                "trip_plan": trip_data.get("trip_plan", {}),
                "created_at": trip_data.get("created_at"),
                "is_public": trip_data.get("is_public", False),
                "cover_image": trip_data.get("cover_image", ""),
                "activity_level": trip_data.get("activity_level", ""),
            }
            
            # Only include rating if it exists and is greater than 0
            rating_value = trip_data.get("rating")
            if rating_value and rating_value > 0:
                trip_dict["rating"] = rating_value
            
            trips_list.append(trip_dict)
        
        # Sort by created_at in Python (descending)
        trips_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return JSONResponse(content={"trips": trips_list})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch trips", "details": str(e)})


@router.get("/api/trip/{trip_id}")
async def get_trip(trip_id: str, user = Depends(get_current_user)):
    """Get specific trip"""
    try:
        trip_doc = db.collection("trips").document(trip_id).get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()

        # Sanitize plan on read to avoid showing legacy travel-only rows.
        try:
            if isinstance(trip_data.get("trip_plan"), dict):
                trip_data["trip_plan"] = sanitize_trip_plan(trip_data["trip_plan"])
        except Exception as e:
            print(f"[WARN] Could not sanitize trip plan on read: {e}")
        
        if trip_data.get("user_id") != user['uid']:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})
        
        return JSONResponse(content=trip_data)
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch trip", "details": str(e)})


@router.delete("/api/trip/{trip_id}")
async def delete_trip(trip_id: str, user = Depends(get_current_user)):
    """Delete trip"""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get("user_id") != user['uid']:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})
        
        trip_ref.delete()
        
        return JSONResponse(content={"message": "Trip deleted successfully"})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to delete trip", "details": str(e)})


@router.put("/api/trip/{trip_id}/rating")
async def update_trip_rating(trip_id: str, rating_request: RatingRequest, user = Depends(get_current_user)):
    """Update trip rating"""
    try:
        if rating_request.rating < 1 or rating_request.rating > 5:
            return JSONResponse(status_code=400, content={"error": "Rating must be between 1 and 5"})
        
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get("user_id") != user['uid']:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})
        
        trip_ref.update({"rating": rating_request.rating})
        
        return JSONResponse(content={"message": "Rating updated successfully", "rating": rating_request.rating})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to update rating", "details": str(e)})


@router.put("/api/trip/{trip_id}/plan")
async def update_trip_plan(trip_id: str, payload: UpdateTripPlanRequest, user = Depends(get_current_user)):
    """Update trip plan (used by Create Plan save)."""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()

        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})

        trip_data = trip_doc.to_dict()
        if trip_data.get("user_id") != user["uid"]:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})

        trip_plan = payload.trip_plan or {}
        trip_name = None
        if isinstance(trip_plan, dict):
            trip_name = trip_plan.get("trip_name")

            # Remove travel-only rows like 'Di chuyển' on save.
            try:
                trip_plan = sanitize_trip_plan(trip_plan)
            except Exception as e:
                print(f"[WARN] Could not sanitize trip plan on save: {e}")

            # Enforce backend constraints on saved plans.
            try:
                trip_plan = cap_activities_per_day(trip_plan, max_per_day=8)
            except Exception as e:
                print(f"[WARN] Could not cap activities per day on save: {e}")

            try:
                trip_plan = apply_time_buffers(
                    trip_plan,
                    active_time_start=8,
                    active_time_end=22,
                    travel_mode=trip_data.get("travel_mode"),
                )
            except Exception as e:
                print(f"[WARN] Could not apply time buffers on save: {e}")

        update_data = {
            "trip_plan": trip_plan,
            "active_time_start": 8,
            "active_time_end": 22,
            "updated_at": datetime.now().isoformat(),
        }
        if trip_name:
            update_data["trip_name"] = trip_name

        trip_ref.update(update_data)
        return JSONResponse(content={"message": "Trip plan updated", "trip_plan": trip_plan})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to update trip plan", "details": str(e)})


@router.put("/api/trip/{trip_id}/cover-image")
async def update_trip_cover_image(trip_id: str, request: CoverImageRequest, user = Depends(get_current_user)):
    """Update trip cover image"""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get("user_id") != user['uid']:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})
        
        trip_plan = trip_data.get("trip_plan", {})
        trip_plan["cover_image"] = request.cover_image
        
        trip_ref.update({
            "trip_plan": trip_plan,
            "cover_image": request.cover_image
        })
        
        return JSONResponse(content={"message": "Cover image updated successfully"})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to update cover image", "details": str(e)})


@router.post("/api/trip/{trip_id}/toggle-public")
async def toggle_trip_public(trip_id: str, request: TogglePublicRequest, user = Depends(get_current_user)):
    """Toggle trip public status"""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        
        if trip_data.get("user_id") != user['uid']:
            return JSONResponse(status_code=403, content={"error": "Not authorized"})
        
        update_data = {
            "is_public": request.is_public,
            "category_tags": request.category_tags if request.category_tags else trip_data.get("categories", [])
        }
        
        if request.cover_image:
            update_data["cover_image"] = request.cover_image
        elif not trip_data.get("cover_image"):
            cover_image = await get_unsplash_image_async(trip_data.get("destination", ""))
            update_data["cover_image"] = cover_image
        
        trip_ref.update(update_data)
        
        return JSONResponse(content={
            "message": f"Trip is now {'public' if request.is_public else 'private'}",
            "is_public": request.is_public
        })
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to toggle public status", "details": str(e)})


@router.post("/api/trip/{trip_id}/view")
async def increment_trip_view(trip_id: str, request: ViewRequest):
    """Increment trip view count"""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        current_views = trip_data.get("views_count", 0)
        
        trip_ref.update({"views_count": current_views + 1})
        
        return JSONResponse(content={"views_count": current_views + 1})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to increment views", "details": str(e)})


@router.post("/api/trip/{trip_id}/like")
async def toggle_trip_like(trip_id: str, request: LikeRequest):
    """Toggle trip like"""
    try:
        trip_ref = db.collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        like_id = f"{trip_id}_{request.user_id}"
        like_ref = db.collection("trip_likes").document(like_id)
        like_doc = like_ref.get()
        
        if like_doc.exists:
            like_ref.delete()
            new_likes = max(0, trip_data.get("likes_count", 0) - 1)
            trip_ref.update({"likes_count": new_likes})
            return JSONResponse(content={"liked": False, "likes_count": new_likes})
        else:
            like_ref.set({
                "trip_id": trip_id,
                "user_id": request.user_id,
                "created_at": datetime.now().isoformat()
            })
            new_likes = trip_data.get("likes_count", 0) + 1
            trip_ref.update({"likes_count": new_likes})
            return JSONResponse(content={"liked": True, "likes_count": new_likes})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/api/trip/{trip_id}/like-status")
async def get_like_status(trip_id: str, user_id: str):
    """Check if user has liked a trip"""
    try:
        like_id = f"{trip_id}_{user_id}"
        like_ref = db.collection("trip_likes").document(like_id)
        like_doc = like_ref.get()
        
        return JSONResponse(content={"liked": like_doc.exists})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/trip/{trip_id}/generate-podcast")
async def generate_podcast(trip_id: str, language: str = "vi", user = Depends(get_current_user)):
    """Generate podcast for trip"""
    try:
        result = await podcast_service.generate_trip_podcast(trip_id, user['uid'], language)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/api/trip/{trip_id}/podcast")
async def get_podcast(trip_id: str):
    """Get podcast for trip"""
    try:
        podcast = podcast_service.get_podcast(trip_id)
        if podcast:
            return JSONResponse(content={"success": True, "podcast": podcast})
        return JSONResponse(status_code=404, content={"success": False, "error": "Podcast not found"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/api/resolve-place")
async def resolve_place(request: Request):
    """Resolve a place name and return enriched details including cost, tips, location, and photo"""
    try:
        body = await request.json()
        place_name = body.get("place_name", "").strip()
        destination = body.get("destination", "").strip()
        budget = body.get("budget", "medium")
        location_coords = body.get("location_coords")
        place_type_hint = body.get("place_type_hint")
        
        if not place_name:
            return JSONResponse(
                status_code=400,
                content={"error": "place_name is required"}
            )
        
        if not destination:
            destination = "Việt Nam"

        from services.maps import get_place_details_async

        place_info = await get_place_details_async(
            place_name,
            destination,
            location_coords=location_coords,
            place_type_hint=place_type_hint,
        )
        
        # Estimate cost based on budget level
        estimated_cost = "100.000 - 200.000 đ"
        if budget == "low":
            estimated_cost = "50.000 - 100.000 đ"
        elif budget == "high":
            estimated_cost = "500.000 - 1.000.000 đ"
        
        # If we got place details with price_level, adjust cost
        if place_info.get("price_level"):
            price_level = place_info["price_level"]
            if price_level == 1:
                estimated_cost = "50.000 - 150.000 đ"
            elif price_level == 2:
                estimated_cost = "150.000 - 400.000 đ"
            elif price_level == 3:
                estimated_cost = "400.000 - 800.000 đ"
            elif price_level >= 4:
                estimated_cost = "800.000 - 2.000.000 đ"
        
        tips = place_info.get("phone") or place_info.get("website") or "Check opening hours before visiting"
        
        return JSONResponse(
            content={
                "place": place_info.get("name", place_name),
                "description": place_info.get("address", ""),
                "estimated_cost": estimated_cost,
                "tips": tips,
                "place_details": place_info,
            }
        )
    
    except Exception as e:
        print(f"Error resolving place: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to resolve place: {str(e)}"}
        )


@router.post("/api/suggest-places")
async def suggest_places(request: Request):
    """Suggest nearby high-rated places to help users pick an option when adding an activity."""
    try:
        body = await request.json()
        destination = (body.get("destination") or "").strip() or "Việt Nam"
        location_coords = body.get("location_coords")
        place_type_hint = body.get("place_type_hint")

        from services.maps import get_place_suggestions_async

        suggestions = await get_place_suggestions_async(
            destination=destination,
            location_coords=location_coords,
            place_type_hint=place_type_hint,
            limit=5,
        )

        return JSONResponse(content={"suggestions": suggestions})
    except Exception as e:
        print(f"Error suggesting places: {e}")
        return JSONResponse(status_code=500, content={"error": f"Failed to suggest places: {str(e)}"})
