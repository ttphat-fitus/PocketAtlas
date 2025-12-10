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
                         CoverImageRequest, TogglePublicRequest, LikeRequest)
from services.ai import create_trip_planning_prompt
from services.maps import async_geocode, enrich_activities_parallel, generate_booking_link
from services.weather import get_weather_forecast_async
from services.image import get_unsplash_image_async
from services.podcast import podcast_service

router = APIRouter()


@router.post("/api/plan-trip")
async def plan_trip(trip_request: TripRequest, user = Depends(get_optional_user)):
    """Generate personalized travel itinerary"""
    try:
        start_time = time.time()
        
        print(f"\n{'='*60}")
        print(f"Trip Planning for: {trip_request.destination}")
        print(f"Duration: {trip_request.duration} days | Budget: {trip_request.budget}")
        print(f"{'='*60}")
        
        trip_prompt = create_trip_planning_prompt(trip_request)
        
        print("[INFO] Calling Gemini AI...")
        response = await model.generate_content_async(trip_prompt)
        raw_text = response.text.strip()
        
        print("[INFO] Parsing JSON response...")
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        
        if not match:
            print("[ERROR] JSON not found in response")
            return JSONResponse(
                status_code=500,
                content={"error": "AI không trả về định dạng JSON hợp lệ", "raw": raw_text[:500]}
            )
        
        json_str = match.group(1) or match.group(2)
        trip_plan = json.loads(json_str)
        
        # Get destination weather forecast with score and warning level
        destination_weather = []
        weather_info = {}
        forecasts = []
        try:
            from datetime import timedelta
            start_date = datetime.strptime(trip_request.start_date, "%Y-%m-%d")
            today = datetime.now()
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
        
        print("[INFO] Enriching activities with Google Places API (PARALLEL mode)...")
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
            
            print("[INFO] Fetching Unsplash cover image...")
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
        print(f"\n{'='*60}")
        print(f"[SUCCESS] Trip Planning completed in {elapsed:.2f} seconds")
        print(f"{'='*60}\n")
        
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
