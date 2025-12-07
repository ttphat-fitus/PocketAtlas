import google.generativeai as genai
from fastapi import FastAPI, Depends, Request
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import json
import re
import requests
import httpx  # Async HTTP client
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from firebase_config import firebase_db
from auth_middleware import get_current_user, get_optional_user
from google.cloud import firestore as firestore_module

GOOGLE_API_KEY = json.load(open("key/chatbot_key.json"))["GOOGLE_API_KEY"]
GOOGLE_MAPS_API_KEY = json.load(open("key/maps_key.json"))["GOOGLE_MAPS_API_KEY"]
WEATHER_API_KEY = json.load(open("key/weather_key.json"))["WeatherAPIKey"]
UNSPLASH_ACCESS_KEY = json.load(open("key/unsplash_key.json"))["credentials"]["accessKey"]

genai.configure(api_key=GOOGLE_API_KEY)

# Configure Gemini model for travel planning
generation_config = {
    "temperature": 0.8,
    "top_p": 0.95,
    "top_k": 40,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

model = genai.GenerativeModel(
    'gemini-2.5-flash',
    generation_config=generation_config,
    safety_settings=safety_settings
)

# ============== FastAPI App ==============
app = FastAPI(
    title="Pocket Atlas API",
    description="AI-powered travel planning API",
    version="1.0.0"
)

# Async HTTP client dùng chung cho toàn bộ app
shared_http_client: Optional[httpx.AsyncClient] = None

@app.on_event("startup")
async def startup_event():
    global shared_http_client
    # Có thể chỉnh timeout chung nếu cần
    shared_http_client = httpx.AsyncClient(timeout=10.0)

@app.on_event("shutdown")
async def shutdown_event():
    global shared_http_client
    if shared_http_client is not None:
        await shared_http_client.aclose()
        shared_http_client = None

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Data Models ==============
class TripRequest(BaseModel):
    destination: str
    duration: int
    budget: str
    start_date: str
    preferences: Optional[str] = ""
    activity_level: Optional[str] = "medium"
    travel_group: Optional[str] = "solo"
    categories: Optional[list] = []
    active_time_start: Optional[int] = 9
    active_time_end: Optional[int] = 21

# ============== Helper Functions ==============

# Async HTTP Client for concurrent requests
async def async_get(
    url: str,
    params: dict = None,
    timeout: int = 10,
    headers: dict = None
) -> dict:
    """Make async GET request with shared httpx.AsyncClient (reuses connections)"""
    from typing import Optional
    global shared_http_client

    try:
        client: Optional[httpx.AsyncClient] = shared_http_client

        # Fallback khi chạy unit test hoặc chưa init app
        if client is None:
            async with httpx.AsyncClient(timeout=timeout) as temp_client:
                resp = await temp_client.get(url, params=params, headers=headers)
        else:
            resp = await client.get(url, params=params, headers=headers, timeout=timeout)

        if resp.status_code == 200:
            return resp.json()
        print(f"Async GET non-200: {resp.status_code} {url}")
        return {}
    except Exception as e:
        print(f"Async GET error: {e} ({url})")
        return {}



async def async_geocode(address: str) -> dict:
    """Async geocoding to get coordinates for an address"""
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": address, "key": GOOGLE_MAPS_API_KEY}
    data = await async_get(url, params, timeout=5)
    
    if data.get("results"):
        location = data["results"][0]["geometry"]["location"]
        return {"lat": location["lat"], "lng": location["lng"]}
    return {"lat": 0, "lng": 0}


def generate_booking_link(destination: str, checkin: str, checkout: str, guests: int = 2) -> str:
    """Generate a Booking.com search link for a destination"""
    from urllib.parse import urlencode, quote
    
    base_url = "https://www.booking.com/searchresults.html"
    params = {
        "ss": destination,
        "checkin": checkin,  # Format: YYYY-MM-DD
        "checkout": checkout,
        "group_adults": guests,
        "no_rooms": 1,
        "group_children": 0,
    }
    return f"{base_url}?{urlencode(params)}"
def get_unsplash_image(destination: str) -> str:
    """Get a high-quality image from Unsplash for a destination"""
    try:
        # Improve query specificity - add Vietnam for Vietnamese cities
        query = destination
        vietnamese_cities = ["Hà Nội", "Hanoi", "Sài Gòn", "Saigon", "Hồ Chí Minh", "Ho Chi Minh", 
                             "Đà Nẵng", "Da Nang", "Huế", "Hue", "Nha Trang", "Vũng Tàu", "Vung Tau"]
        if any(city.lower() in destination.lower() for city in vietnamese_cities):
            query = f"{destination} Vietnam cityscape"
        else:
            query = f"{destination} travel landmark cityscape"
        
        url = "https://api.unsplash.com/search/photos"
        params = {
            "client_id": UNSPLASH_ACCESS_KEY,
            "query": query,
            "per_page": 1,
            "orientation": "landscape",
            "content_filter": "high"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("results") and len(data["results"]) > 0:
                image_url = data["results"][0]["urls"]["regular"]
                print(f"✓ Unsplash: Found image for '{destination}'")
                return image_url
            else:
                print(f"⚠ Unsplash: No results for '{destination}'")
        else:
            print(f"✗ Unsplash API Error {response.status_code}: {response.text[:100]}")
            
    except Exception as e:
        print(f"✗ Unsplash Exception: {e}")
    
    # Fallback to Lorem Picsum
    seed = destination.replace(' ', '').replace(',', '').lower()
    fallback_url = f"https://picsum.photos/seed/{seed}/1200/800"
    print(f"→ Using fallback image for '{destination}'")
    return fallback_url


async def get_unsplash_image_async(destination: str) -> str:
    """Async version: Get a high-quality image from Unsplash for a destination (reusing HTTP client)"""
    try:
        query = destination
        vietnamese_cities = [
            "Hà Nội", "Hanoi", "Sài Gòn", "Saigon", "Hồ Chí Minh", "Ho Chi Minh",
            "Đà Nẵng", "Da Nang", "Huế", "Hue", "Nha Trang", "Vũng Tàu", "Vung Tau"
        ]
        if any(city.lower() in destination.lower() for city in vietnamese_cities):
            query = f"{destination} Vietnam cityscape"
        else:
            query = f"{destination} travel landmark cityscape"

        url = "https://api.unsplash.com/search/photos"
        params = {
            "client_id": UNSPLASH_ACCESS_KEY,
            "query": query,
            "per_page": 1,
            "orientation": "landscape",
            "content_filter": "high"
        }

        data = await async_get(url, params=params, timeout=10)
        if data.get("results"):
            first = data["results"][0]
            image_url = first.get("urls", {}).get("regular")
            if image_url:
                print(f"✓ Unsplash (async): Found image for '{destination}'")
                return image_url
            print(f"⚠ Unsplash (async): No url in first result for '{destination}'")
        else:
            print(f"⚠ Unsplash (async): No results for '{destination}'")

    except Exception as e:
        print(f"✗ Unsplash Exception (async): {e}")

    # Fallback
    seed = destination.replace(' ', '').replace(',', '').lower()
    fallback_url = f"https://picsum.photos/seed/{seed}/1200/800"
    print(f"→ Using fallback image for '{destination}'")
    return fallback_url



def get_weather_forecast(lat: float, lng: float, days: int = 10) -> dict:
    """Get weather forecast using WeatherAPI for detailed conditions"""
    try:
        from datetime import datetime, timedelta
        
        # Get today's date
        today = datetime.now()
        
        # WeatherAPI endpoint - supports up to 14 days on paid plans, 3 on free
        url = "http://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHER_API_KEY,
            "q": f"{lat},{lng}",
            "days": min(days, 14),  # Max 14 days
            "aqi": "no",
            "alerts": "no"
        }
        
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        
        forecast_days = data.get("forecast", {}).get("forecastday", [])
        
        forecasts = []
        for day_data in forecast_days:
            day_info = day_data.get("day", {})
            date_str = day_data.get("date", "")
            
            # Get condition text for LLM context
            condition = day_info.get("condition", {}).get("text", "Clear")
            
            # Determine if weather is suitable for outdoor/indoor activities
            is_rainy = "rain" in condition.lower() or "drizzle" in condition.lower()
            is_sunny = "sunny" in condition.lower() or "clear" in condition.lower()
            
            forecasts.append({
                "date": date_str,
                "day_name": datetime.strptime(date_str, "%Y-%m-%d").strftime("%A"),
                "temp_max": round(day_info.get("maxtemp_c", 0)),
                "temp_min": round(day_info.get("mintemp_c", 0)),
                "precipitation": round(day_info.get("totalprecip_mm", 0), 1),
                "condition": condition,
                "humidity": day_info.get("avghumidity", 0),
                "rain_chance": day_info.get("daily_chance_of_rain", 0),
                "is_rainy": is_rainy,
                "is_sunny": is_sunny,
                "suggestion": "Indoor activities recommended" if is_rainy else "Great for outdoor activities" if is_sunny else "Mixed activities suitable"
            })
        
        print(f"      → Weather forecast: {len(forecasts)} days with detailed conditions")
        
        return {"forecasts": forecasts}
    except Exception as e:
        print(f"Weather API error: {e}")
        return {"forecasts": []}


async def get_weather_forecast_async(lat: float, lng: float, days: int = 10) -> dict:
    """Async: Get weather forecast using WeatherAPI (reusing shared HTTP client)"""
    try:
        url = "http://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHER_API_KEY,
            "q": f"{lat},{lng}",
            "days": min(days, 14),  # Max 14 days
            "aqi": "no",
            "alerts": "no"
        }

        data = await async_get(url, params=params, timeout=10)
        if not data:
            return {"forecasts": []}

        forecast_days = data.get("forecast", {}).get("forecastday", [])

        forecasts = []
        for day_data in forecast_days:
            day_info = day_data.get("day", {})
            date_str = day_data.get("date", "")

            condition = day_info.get("condition", {}).get("text", "Clear")
            is_rainy = "rain" in condition.lower() or "drizzle" in condition.lower()
            is_sunny = "sunny" in condition.lower() or "clear" in condition.lower()

            forecasts.append({
                "date": date_str,
                "day_name": datetime.strptime(date_str, "%Y-%m-%d").strftime("%A"),
                "temp_max": round(day_info.get("maxtemp_c", 0)),
                "temp_min": round(day_info.get("mintemp_c", 0)),
                "precipitation": round(day_info.get("totalprecip_mm", 0), 1),
                "condition": condition,
                "humidity": day_info.get("avghumidity", 0),
                "rain_chance": day_info.get("daily_chance_of_rain", 0),
                "is_rainy": is_rainy,
                "is_sunny": is_sunny,
                "suggestion": (
                    "Indoor activities recommended" if is_rainy else
                    "Great for outdoor activities" if is_sunny else
                    "Mixed activities suitable"
                )
            })

        print(f"      → Weather forecast (async): {len(forecasts)} days with detailed conditions")
        return {"forecasts": forecasts}
    except Exception as e:
        print(f"Weather API error (async): {e}")
        return {"forecasts": []}



def get_place_details(place_name: str, location: str) -> dict:
    """Enhanced place details using Google Maps API with weather, photos, ratings, and more"""
    def sanitize(s: str) -> str:
        if not s:
            return ""
        s = re.sub(r'\(.*?VD:.*?\)', '', s, flags=re.IGNORECASE)
        s = re.sub(r'VD:\s*', '', s, flags=re.IGNORECASE)
        s = re.sub(r'[\(\)\[\]\"…\n\r]', ' ', s)
        s = re.sub(r'[^0-9A-Za-zÀ-ỹ\s\-\,\.]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s

    try:
        q = sanitize(place_name)
        if not q or len(q) < 3:
            return {
                "name": place_name, "address": "", "rating": 0, "total_ratings": 0, 
                "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
                "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
                "reviews": [], "google_maps_link": ""
            }
        
        headers = {"User-Agent": "PocketAtlas/1.0"}
        
        # Get location coordinates for bias (improve accuracy)
        location_bias = ""
        try:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geocode_params = {"address": location, "key": GOOGLE_MAPS_API_KEY}
            geocode_resp = requests.get(geocode_url, params=geocode_params, timeout=5)
            geocode_data = geocode_resp.json()
            if geocode_data.get("results"):
                geo_loc = geocode_data["results"][0]["geometry"]["location"]
                location_bias = f"point:{geo_loc['lat']},{geo_loc['lng']}"
        except:
            pass
        
        # Step 1: Google Places Text Search with location bias
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        search_params = {
            "query": f"{q} {location}",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi"
        }
        
        # Add location bias if available (prioritizes results near destination)
        if location_bias:
            search_params["locationbias"] = location_bias
        
        resp = requests.get(search_url, params=search_params, timeout=10, headers=headers)
        data = resp.json()
        
        if data.get("status") != "OK":
            print(f"      ⚠ Google Places API error: {data.get('status')} - {data.get('error_message', 'No details')}")
            return {
                "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
                "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
                "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
                "reviews": [], "google_maps_link": ""
            }
        
        results = data.get("results", [])
        print(f"      → Google Places Search '{q}' → {len(results)} results")
        
        if not results:
            return {
                "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
                "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
                "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
                "reviews": [], "google_maps_link": ""
            }
        
        place = results[0]
        place_id = place.get("place_id")
        geometry = place.get("geometry", {})
        location_data = geometry.get("location", {})
        lat = float(location_data.get("lat", 0))
        lng = float(location_data.get("lng", 0))
        
        # Step 2: Get Place Details (richer info)
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            "place_id": place_id,
            "fields": "name,formatted_address,rating,user_ratings_total,photos,geometry,types,price_level,formatted_phone_number,website,opening_hours,reviews",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi"
        }
        
        details_resp = requests.get(details_url, params=details_params, timeout=10, headers=headers)
        details_data = details_resp.json()
        
        if details_data.get("status") == "OK":
            place_details = details_data.get("result", {})
        else:
            place_details = place
        
        # Extract photo URL
        photo_url = ""
        photos = place_details.get("photos", [])
        if photos and len(photos) > 0:
            photo_reference = photos[0].get("photo_reference")
            photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_reference}&key={GOOGLE_MAPS_API_KEY}"
        
        # Get weather forecast
        weather_data = get_weather_forecast(lat, lng) if lat != 0 and lng != 0 else {"forecasts": []}
        
        # Extract reviews (top 3)
        reviews_raw = place_details.get("reviews", [])
        reviews = []
        for review in reviews_raw[:3]:
            reviews.append({
                "author": review.get("author_name", "Anonymous"),
                "rating": review.get("rating", 0),
                "text": review.get("text", "")[:200] + "..." if len(review.get("text", "")) > 200 else review.get("text", ""),
                "time": review.get("relative_time_description", "")
            })
        
        # Extract opening hours
        opening_hours = []
        opening_hours_data = place_details.get("opening_hours", {})
        if opening_hours_data.get("weekday_text"):
            opening_hours = opening_hours_data.get("weekday_text", [])
        
        # Generate Google Maps link
        google_maps_link = ""
        if lat != 0 and lng != 0:
            google_maps_link = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={place_id}"
        
        # Check if this is a hotel/lodging and generate Booking.com link
        place_types = place_details.get("types", [])
        booking_link = ""
        is_hotel = any(t in place_types for t in ["lodging", "hotel", "resort", "guest_house", "motel"])
        if is_hotel:
            place_display_name = place_details.get("name", place_name)
            # Use place name and location for better search
            booking_link = f"https://www.booking.com/searchresults.html?ss={requests.utils.quote(place_display_name + ' ' + location)}"
        
        return {
            "name": place_details.get("name", place_name),
            "address": place_details.get("formatted_address", ""),
            "rating": place_details.get("rating", 0),
            "total_ratings": place_details.get("user_ratings_total", 0),
            "photo_url": photo_url,
            "lat": lat,
            "lng": lng,
            "types": place_details.get("types", []),
            "price_level": place_details.get("price_level", 0),
            "weather": weather_data,
            "phone": place_details.get("formatted_phone_number", ""),
            "website": place_details.get("website", ""),
            "opening_hours": opening_hours,
            "reviews": reviews,
            "google_maps_link": google_maps_link,
            "booking_link": booking_link,
            "is_hotel": is_hotel
        }
    
    except Exception as e:
        print(f"Error fetching Google Maps API for '{place_name}': {e}")
        return {
            "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
            "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
            "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
            "reviews": [], "google_maps_link": "", "booking_link": "", "is_hotel": False
        }


async def get_place_details_async(place_name: str, location: str, location_coords: dict = None) -> dict:
    """Async: Enhanced place details using Google Maps API (reusing shared HTTP client)"""
    def sanitize(s: str) -> str:
        if not s:
            return ""
        s = re.sub(r'\(.*?VD:.*?\)', '', s, flags=re.IGNORECASE)
        s = re.sub(r'VD:\s*', '', s, flags=re.IGNORECASE)
        s = re.sub(r'[\(\)\[\]\"…\n\r]', ' ', s)
        s = re.sub(r'[^0-9A-Za-zÀ-ỹ\s\-\,\.]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s

    empty_result = {
        "name": place_name,
        "address": "",
        "rating": 0,
        "total_ratings": 0,
        "photo_url": "",
        "lat": 0,
        "lng": 0,
        "types": [],
        "price_level": 0,
        "weather": {"forecasts": []},
        "phone": "",
        "website": "",
        "opening_hours": [],
        "reviews": [],
        "google_maps_link": "",
        "booking_link": "",
        "is_hotel": False,
    }

    try:
        q = sanitize(place_name)
        if not q or len(q) < 3:
            return empty_result

        headers = {"User-Agent": "PocketAtlas/1.0"}

        # Location bias: ưu tiên dùng location_coords truyền vào
        location_bias = ""
        if location_coords and location_coords.get("lat"):
            location_bias = f"point:{location_coords['lat']},{location_coords['lng']}"
        else:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geocode_params = {"address": location, "key": GOOGLE_MAPS_API_KEY}
            geocode_data = await async_get(geocode_url, params=geocode_params, timeout=5, headers=headers)
            if geocode_data.get("results"):
                geo_loc = geocode_data["results"][0]["geometry"]["location"]
                location_bias = f"point:{geo_loc['lat']},{geo_loc['lng']}"

        # Step 1: Text Search
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        search_params = {
            "query": f"{q} {location}",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi",
        }
        if location_bias:
            search_params["locationbias"] = location_bias

        search_data = await async_get(search_url, params=search_params, timeout=10, headers=headers)
        if search_data.get("status") != "OK" or not search_data.get("results"):
            return empty_result

        place = search_data["results"][0]
        place_id = place.get("place_id")
        geometry = place.get("geometry", {})
        location_data = geometry.get("location", {})
        lat = float(location_data.get("lat", 0))
        lng = float(location_data.get("lng", 0))

        # Step 2: Place Details
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            "place_id": place_id,
            "fields": (
                "name,formatted_address,rating,user_ratings_total,photos,geometry,"
                "types,price_level,formatted_phone_number,website,opening_hours,reviews"
            ),
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi",
        }

        details_data = await async_get(details_url, params=details_params, timeout=10, headers=headers)
        if details_data.get("status") == "OK":
            place_details = details_data.get("result", place)
        else:
            place_details = place

        # Photo
        photo_url = ""
        photos = place_details.get("photos", [])
        if photos:
            photo_reference = photos[0].get("photo_reference")
            if photo_reference:
                photo_url = (
                    "https://maps.googleapis.com/maps/api/place/photo"
                    f"?maxwidth=800&photo_reference={photo_reference}&key={GOOGLE_MAPS_API_KEY}"
                )

        # Weather: giữ trống trong async version để tránh nested API
        weather_data = {"forecasts": []}

        # Reviews (max 3)
        reviews_raw = place_details.get("reviews", [])
        reviews = []
        for review in reviews_raw[:3]:
            text = review.get("text", "") or ""
            reviews.append({
                "author": review.get("author_name", "Anonymous"),
                "rating": review.get("rating", 0),
                "text": text[:200] + "..." if len(text) > 200 else text,
                "time": review.get("relative_time_description", ""),
            })

        # Opening hours
        opening_hours = []
        opening_hours_data = place_details.get("opening_hours", {})
        if opening_hours_data.get("weekday_text"):
            opening_hours = opening_hours_data["weekday_text"]

        # Maps link
        google_maps_link = ""
        if lat != 0 and lng != 0 and place_id:
            google_maps_link = (
                "https://www.google.com/maps/search/?api=1"
                f"&query={lat},{lng}&query_place_id={place_id}"
            )

        # Booking link nếu là hotel
        place_types = place_details.get("types", [])
        booking_link = ""
        is_hotel = any(t in place_types for t in ["lodging", "hotel", "resort", "guest_house", "motel"])
        if is_hotel:
            place_display_name = place_details.get("name", place_name)
            from urllib.parse import quote
            booking_link = (
                "https://www.booking.com/searchresults.html?ss="
                f"{quote(place_display_name + ' ' + location)}"
            )

        return {
            "name": place_details.get("name", place_name),
            "address": place_details.get("formatted_address", ""),
            "rating": place_details.get("rating", 0),
            "total_ratings": place_details.get("user_ratings_total", 0),
            "photo_url": photo_url,
            "lat": lat,
            "lng": lng,
            "types": place_details.get("types", []),
            "price_level": place_details.get("price_level", 0),
            "weather": weather_data,
            "phone": place_details.get("formatted_phone_number", ""),
            "website": place_details.get("website", ""),
            "opening_hours": opening_hours,
            "reviews": reviews,
            "google_maps_link": google_maps_link,
            "booking_link": booking_link,
            "is_hotel": is_hotel,
        }

    except Exception as e:
        print(f"Error fetching Google Maps API (async) for '{place_name}': {e}")
        return empty_result



async def fetch_destination_weather(trip_request: TripRequest) -> List[dict]:
    """
    Async function to fetch weather forecast for trip destination.
    Can be run in parallel with other operations like enrichment and image fetching.
    
    Args:
        trip_request: TripRequest object with destination and trip details
    
    Returns:
        List of weather forecast dictionaries for each day of the trip
    """
    destination_weather = []
    try:
        start_date = datetime.strptime(trip_request.start_date, "%Y-%m-%d")
        today = datetime.now()
        days_until_trip = (start_date - today).days
        
        # Only fetch weather if trip starts within 14 days (WeatherAPI free tier supports up to 14 days)
        if 0 <= days_until_trip <= 14:
            # Use async geocoding and weather fetching
            location_coords = await async_geocode(trip_request.destination)
            
            if location_coords.get("lat"):
                weather_data = await get_weather_forecast_async(
                    location_coords["lat"], 
                    location_coords["lng"], 
                    trip_request.duration
                )
                forecasts = weather_data.get("forecasts", [])
                print(f"✓ Weather API (async) returned {len(forecasts)} days of forecast")
                
                # Match weather to trip dates
                for i in range(min(trip_request.duration, len(forecasts))):
                    trip_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
                    if i < len(forecasts):
                        fc = forecasts[i]
                        destination_weather.append({
                            "day": i + 1,
                            "date": trip_date,
                            "condition": fc.get("condition", "Clear"),
                            "temp_max": fc.get("temp_max", 0),
                            "temp_min": fc.get("temp_min", 0),
                            "rain_chance": fc.get("rain_chance", 0),
                            "humidity": fc.get("humidity", 0),
                            "suggestion": fc.get("suggestion", "")
                        })
                
                print(f"✓ Weather forecast added for {len(destination_weather)} days")
        else:
            print(f"⚠ Trip starts in {days_until_trip} days - beyond weather forecast range (14 days), skipping weather fetch")
    
    except Exception as e:
        print(f"Could not fetch destination weather: {e}")
    
    return destination_weather


async def enrich_activities_parallel(
    trip_plan: dict,
    destination: str,
    batch_size: int = 8
) -> dict:
    """
    Enrich all activities with place details in parallel batches.
    De-duplicate by place_name: mỗi place chỉ gọi Google Places 1 lần.
    """
    from typing import Dict, List

    # Geocode destination một lần để dùng bias chung
    location_coords = await async_geocode(destination)

    place_to_activities: Dict[str, List[dict]] = {}

    for day in trip_plan.get("days", []):
        for activity in day.get("activities", []):
            place_name = activity.get("place", "")
            if not place_name:
                continue
            place_to_activities.setdefault(place_name, []).append(activity)

    unique_places = list(place_to_activities.keys())
    total_places = len(unique_places)
    total_activities = sum(len(v) for v in place_to_activities.values())

    print(
        f"📍 Enriching {total_activities} activities across "
        f"{total_places} unique places in parallel batches of {batch_size}..."
    )

    for batch_start in range(0, total_places, batch_size):
        batch_end = min(batch_start + batch_size, total_places)
        batch_places = unique_places[batch_start:batch_end]

        print(
            f"  → Batch {batch_start // batch_size + 1}: "
            f"Places {batch_start + 1}-{batch_end}"
        )

        tasks = [
            get_place_details_async(place_name, destination, location_coords)
            for place_name in batch_places
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for place_name, result in zip(batch_places, results):
            activities = place_to_activities.get(place_name, [])
            if isinstance(result, Exception):
                print(f"    ⚠ Error for {place_name[:30]}: {result}")
                fallback_details = {
                    "name": place_name,
                    "address": "",
                    "rating": 0,
                    "total_ratings": 0,
                    "photo_url": "",
                    "lat": 0,
                    "lng": 0,
                    "types": [],
                    "price_level": 0,
                    "weather": {"forecasts": []},
                    "phone": "",
                    "website": "",
                    "opening_hours": [],
                    "reviews": [],
                    "google_maps_link": "",
                    "booking_link": "",
                    "is_hotel": False,
                }
                for act in activities:
                    act["place_details"] = fallback_details
            else:
                for act in activities:
                    act["place_details"] = result
                if result.get("address"):
                    print(f"    ✓ {place_name[:30]}...")

    print(f"✅ Enriched {total_activities} activities successfully!")
    return trip_plan




def calculate_user_badges(uid: str) -> dict:
    """Calculate user badges based on activity"""
    try:
        user_ref = firebase_db.collection("users").document(uid)
        trips_ref = user_ref.collection("trips")
        
        # Count public trips
        public_trips = trips_ref.where("is_public", "==", True).stream()
        public_count = sum(1 for _ in public_trips)
        
        # Count total trips
        all_trips = trips_ref.stream()
        total_trips = sum(1 for _ in all_trips)
        
        # Calculate total likes received on public trips
        total_likes = 0
        public_trips_stream = trips_ref.where("is_public", "==", True).stream()
        for trip in public_trips_stream:
            trip_data = trip.to_dict()
            total_likes += len(trip_data.get("liked_by", []))
        
        # Calculate badges
        badges = []
        if total_trips >= 20:
            badges.append("Explorer")
        if total_trips >= 50:
            badges.append("Veteran Traveler")
        if public_count >= 10:
            badges.append("Local Guide")
        if total_likes >= 100:
            badges.append("Top Reviewer")
        
        # Calculate stars (1 star per public trip, max 5 stars display)
        stars = min(public_count, 5)
        
        stats = {
            "total_trips": total_trips,
            "public_trips": public_count,
            "total_likes": total_likes,
            "badges": badges,
            "stars": stars
        }
        
        # Update user profile with stats
        user_ref.update({
            "stats": stats,
            "updated_at": datetime.now().isoformat()
        })
        
        return stats
    
    except Exception as e:
        print(f"Error calculating badges: {e}")
        return {
            "total_trips": 0,
            "public_trips": 0,
            "total_likes": 0,
            "badges": [],
            "stars": 0
        }


def create_trip_planning_prompt(trip_request: TripRequest) -> str:
    """Create a specialized prompt for Gemini AI to generate travel itineraries"""
    
    budget_context = {
        "low": "tiết kiệm (ưu tiên địa điểm miễn phí, ăn uống bình dân, di chuyển bằng phương tiện công cộng)",
        "medium": "trung bình (cân bằng giữa chất lượng và chi phí, ăn uống đa dạng, di chuyển linh hoạt)",
        "high": "cao cấp (ưu tiên trải nghiệm sang trọng, resort 4-5 sao, nhà hàng cao cấp, di chuyển riêng tư)"
    }
    
    activity_context = {
        "low": "thư giãn (ít hoạt động thể chất, nhiều thời gian nghỉ ngơi)",
        "medium": "cân bằng (kết hợp tham quan và nghỉ ngơi hợp lý)",
        "high": "năng động (nhiều hoạt động thể chất, leo núi, phiêu lưu)"
    }
    
    travel_group_context = {
        "solo": "du khách một mình (linh hoạt, tự do khám phá)",
        "couple": "cặp đôi (lãng mạn, riêng tư)",
        "family": "gia đình (phù hợp mọi lứa tuổi, an toàn)",
        "friends": "nhóm bạn (vui vẻ, sôi động)"
    }
    
    budget_desc = budget_context.get(trip_request.budget, "trung bình")
    activity_desc = activity_context.get(trip_request.activity_level, "cân bằng")
    group_desc = travel_group_context.get(trip_request.travel_group, "du khách một mình")
    
    categories_text = ", ".join(trip_request.categories) if trip_request.categories else "tất cả các danh mục"
    
    # Note: Weather context will be fetched separately in async manner
    # This function is sync, so we don't add weather here for the prompt
    # Weather is fetched async in plan_trip endpoint instead
    weather_context = ""
    
    prompt = f"""
Bạn là một chuyên gia tư vấn du lịch chuyên nghiệp với 15 năm kinh nghiệm trong việc lập kế hoạch du lịch tại Việt Nam và thế giới.

NHIỆM VỤ: Tạo một kế hoạch du lịch chi tiết, thực tế và hấp dẫn
THÔNG TIN CHUYẾN ĐI:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Địa điểm: {trip_request.destination}
• Thời gian: {trip_request.duration} ngày
• Ngày bắt đầu: {trip_request.start_date}
• Ngân sách: {budget_desc}
• Mức độ hoạt động: {activity_desc}
• Nhóm du lịch: {group_desc}
• Danh mục ưu tiên: {categories_text}
• Thời gian hoạt động: {str(trip_request.active_time_start).zfill(2)}:00 - {str(trip_request.active_time_end).zfill(2)}:00
• Sở thích khác: {trip_request.preferences if trip_request.preferences else "Không có yêu cầu đặc biệt"}{weather_context}

YÊU CẦU QUAN TRỌNG:
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **Địa điểm phải CỤ THỂ, CHÍNH XÁC và TÌM ĐƯỢC TRÊN GOOGLE MAPS**: 
   - Sử dụng TÊN CHÍNH XÁC của địa danh, nhà hàng, quán ăn, khách sạn
   - Ví dụ TÊN ĐÚNG: "Hồ Xuân Hương", "Chợ Đà Lạt", "Ga Đà Lạt", "Crazy House", "Dinh Bảo Đại"
   - Ví dụ TÊN SAI: "Một nhà hàng địa phương", "Khách sạn lưu trú", "Ăn trưa tại nhà hàng"
   - KHÔNG thêm "VD:", "(VD: ...)", hoặc ví dụ trong ngoặc đơn
   - KHÔNG dùng cụm từ chung chung như "Nhận phòng", "Mua quà", "Trả phòng"
   - Nếu là nhà hàng/quán ăn: ghi TÊN CỤ THỂ (ví dụ: "Bánh Mì Phượng", "Quán Cơm Niêu")
   - Nếu là khách sạn: ghi TÊN THẬT (ví dụ: "Dalat Palace Hotel", "Ana Mandara Villas")

2. **Thời gian hợp lý**: 
   - Bắt đầu từ 7:00-8:00, kết thúc 20:00-21:00
   - Mỗi hoạt động từ 1.5-3 giờ
   - Có thời gian di chuyển, nghỉ ngơi giữa các điểm

3. **Chi phí THỰC TẾ**:
   - Ngân sách LOW: 50.000-150.000 ₫/hoạt động
   - Ngân sách MEDIUM: 150.000-500.000 ₫/hoạt động  
   - Ngân sách HIGH: 500.000-2.000.000 ₫/hoạt động
   - QUAN TRỌNG: Mọi hoạt động ĐỀU PHẢI có chi phí cụ thể, KHÔNG được để "0 ₫" hoặc "Miễn phí"
   - Nếu địa điểm miễn phí thì ghi chi phí ăn uống/đi lại kèm theo (VD: "20.000 - 50.000 ₫")

4. **Đa dạng hoạt động**: Văn hóa, ẩm thực, thiên nhiên, giải trí, mua sắm

5. **Tips THỰC TIỄN**: Thời gian tốt nhất, cách di chuyển, lưu ý đặc biệt

6. **CHI PHÍ FORMAT**: Chỉ ghi số tiền và đơn vị ₫, KHÔNG thêm mô tả trong ngoặc đơn
   - ĐÚNG: "100.000 - 200.000 ₫" hoặc "50.000 ₫"
   - SAI: "100.000 - 200.000 ₫ (vé vào cửa + ăn sáng)"
   - SAI: "0 ₫" hoặc "Miễn phí" - luôn ghi chi phí thực tế

FORMAT JSON (CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{
  "trip_name": "Tên chuyến đi hấp dẫn (VD: 'Khám Phá Hà Nội - Hành Trình Nghìn Năm Văn Hiến')",
  "overview": "Tổng quan 2-3 câu về điểm nổi bật của chuyến đi",
  "total_estimated_cost": "5.000.000 - 7.000.000 ₫",
  "days": [
    {{
      "day": 1,
      "title": "Tiêu đề cho ngày 1 (VD: 'Khám phá Old Quarter & Văn hóa cổ đô')",
      "activities": [
        {{
          "time": "08:00 - 10:00",
          "place": "Hồ Hoàn Kiếm",
          "description": "Mô tả hoạt động chi tiết: làm gì, trải nghiệm gì, ăn gì, chi phí gồm những gì",
          "estimated_cost": "100.000 - 200.000 ₫",
          "tips": "Lời khuyên cụ thể: thời gian tốt nhất, cách di chuyển, lưu ý"
        }},
        {{
          "time": "10:30 - 12:30",
          "place": "TÊN ĐỊA ĐIỂM CỤ THỂ TIẾP THEO",
          "description": "...",
          "estimated_cost": "...",
          "tips": "..."
        }}
      ]
    }},
    {{
      "day": 2,
      "title": "...",
      "activities": [...]
    }}
  ],
  "packing_list": [
    "Giấy tờ tùy thân, CMND/CCCD",
    "Đồ cần mang phù hợp với thời tiết và hoạt động",
    "Thuốc men cá nhân",
    "Sạc dự phòng, camera"
  ],
  "travel_tips": [
    "Mẹo 1: Thời tiết và cách ăn mặc",
    "Mẹo 2: Phương tiện di chuyển tốt nhất",
    "Mẹo 3: Món ăn đặc sản không thể bỏ qua",
    "Mẹo 4: Lưu ý an toàn và văn hóa địa phương"
  ]
}}

⚡ LƯU Ý QUAN TRỌNG:
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Mỗi ngày có 4-6 hoạt động
- Địa điểm phải là TÊN THẬT, dễ tìm trên Google Maps
- Chi phí phải PHÙ HỢP với mức ngân sách đã chọn
- Kế hoạch phải KHẢ THI và DỄ THỰC HIỆN
- Chỉ trả về JSON, KHÔNG thêm markdown hay text giải thích

QUY TẮC VỀ TÊN ĐỊA ĐIỂM (BẮT BUỘC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAI: "Ăn trưa tại nhà hàng (VD: Quán Ngon)"
ĐÚNG: "Quán Ngon
SAI: "Thưởng thức món ăn đường phố"  
ĐÚNG: "Chợ Đêm Đà Lạt
SAI: "Nhận phòng khách sạn"
ĐÚNG: "Dalat Palace Heritage Hotel
SAI: "Tham quan chùa địa phương"
ĐÚNG: "Chùa Linh Phước
SAI: "Mua sắm quà lưu niệm"
ĐÚNG: "Chợ Đà Lạt"

Trong trường "place": CHỈ GHI TÊN ĐỊA ĐIỂM, KHÔNG GHI MÔ TẢ HOẠT ĐỘNG
Mô tả hoạt động để trong trường "description"
TUYỆT ĐỐI KHÔNG dùng "VD:" hay "(VD: ...)" trong trường "place"

BẮT ĐẦU TẠO KẾ HOẠCH NGAY!
"""
    
    return prompt


# ============== API Endpoints ==============

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Pocket Atlas API",
        "version": "2.0.0 (async optimized)",
        "features": [
            "asyncio.gather() for parallel API calls",
            "Batch processing for Google Places API",
            "Async weather and image fetching"
        ],
        "endpoints": {
            "plan_trip": "/api/plan-trip (POST)",
            "docs": "/docs"
        }
    }


@app.post("/api/plan-trip")
async def plan_trip(trip_request: TripRequest, user = Depends(get_optional_user)):
    """
    Main endpoint: Generate personalized travel itinerary and save to Firestore.
    
    OPTIMIZATION: Uses asyncio.gather() for parallel API calls:
    - Parallel place details enrichment (N activities at a time)
    - Async weather and (optionally) cover image fetching
    """
    try:
        import time
        start_time = time.time()
        
        print(f"\n{'='*60}")
        print(f"ASYNC Trip Planning for: {trip_request.destination}")
        print(f"Duration: {trip_request.duration} days | Budget: {trip_request.budget}")
        print(f"{'='*60}")
        
        trip_prompt = create_trip_planning_prompt(trip_request)
        
        print("Calling Gemini AI...")
        response = await model.generate_content_async(trip_prompt)
        raw_text = response.text.strip()
        
        print("Parsing JSON response...")
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        
        if not match:
            print("JSON not found in response")
            return JSONResponse(
                status_code=500,
                content={
                    "error": "AI không trả về định dạng JSON hợp lệ",
                    "raw": raw_text[:500]
                }
            )
        
        json_str = match.group(1) or match.group(2)
        trip_plan = json.loads(json_str)

        # ========== RUN WEATHER + ENRICHMENT (+ COVER) IN PARALLEL ==========
        print("🚀 Running weather fetch, activity enrichment, and cover image fetch in parallel...")

        # 1) Task weather
        weather_task = fetch_destination_weather(trip_request)

        # 2) Task enrich
        enrichment_task = enrich_activities_parallel(
            trip_plan,
            trip_request.destination,
            batch_size=8  # có thể tăng lên 8–10 sau khi test
        )

        # 3) Task cover image: chỉ fetch nếu có user (nếu không dùng cover cho anonymous)
        cover_image_task = None
        if user:
            cover_image_task = get_unsplash_image_async(trip_request.destination)

        # Chạy song song (2 hoặc 3 task tuỳ có user hay không)
        if cover_image_task:
            destination_weather, enriched_plan, cover_image_url = await asyncio.gather(
                weather_task,
                enrichment_task,
                cover_image_task
            )
        else:
            destination_weather, enriched_plan = await asyncio.gather(
                weather_task,
                enrichment_task
            )
            cover_image_url = None

        # Cập nhật trip_plan với kết quả
        trip_plan = enriched_plan
        trip_plan["weather_forecast"] = destination_weather

        # Thống kê
        elapsed = time.time() - start_time
        total_activities = sum(
            len(day.get("activities", []))
            for day in trip_plan.get("days", [])
        )
        print(f"✅ ASYNC Trip Planning completed (after AI) in {elapsed:.2f} seconds")
        print(f"Trip plan generated with {total_activities} activities!")

        # ========== SAVE TO FIRESTORE IF USER AUTHENTICATED ==========
        trip_id = None
        if user:
            trip_id = f"{user['uid']}_{int(datetime.now().timestamp())}"

            if cover_image_url:
                print(f"✓ Using cover image: {cover_image_url[:50]}...")
            else:
                print("⚠ No cover image found")

            trip_data = {
                "trip_id": trip_id,
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
                "created_at": datetime.now().isoformat(),
                "rating": 0,
                "is_public": False,
                "views_count": 0,
                "likes_count": 0,
                "category_tags": trip_request.categories or [],
                "cover_image": cover_image_url,
            }

            firebase_db.collection("users") \
                .document(user['uid']) \
                .collection("trips") \
                .document(trip_id) \
                .set(trip_data)

            print(f"✓ Trip saved to Firestore: {trip_id}")

            # add metadata vào response
            trip_plan["trip_id"] = trip_id
            trip_plan["cover_image"] = cover_image_url

        # Log tổng thời gian
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"✅ ASYNC Trip Planning completed in {elapsed:.2f} seconds")
        print(f"{'='*60}\n")

        return JSONResponse(content=trip_plan)

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Lỗi parse JSON từ AI", "details": str(e)}
        )

    except Exception as e:
        print(f"Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Lỗi máy chủ", "details": str(e)}
        )


@app.get("/api/my-trips")
async def get_my_trips(user = Depends(get_current_user)):
    """Get all trips for the authenticated user"""
    try:
        trips_ref = firebase_db.collection("users").document(user['uid']).collection("trips")
        trips = trips_ref.order_by("created_at", direction=firestore_module.Query.DESCENDING).stream()
        
        trips_list = []
        for trip in trips:
            trip_data = trip.to_dict()
            trips_list.append({
                "trip_id": trip_data.get("trip_id"),
                "destination": trip_data.get("destination"),
                "duration": trip_data.get("duration"),
                "budget": trip_data.get("budget"),
                "start_date": trip_data.get("start_date"),
                "created_at": trip_data.get("created_at"),
                "trip_name": trip_data.get("trip_plan", {}).get("trip_name", ""),
                "rating": trip_data.get("rating", 0),
                "activity_level": trip_data.get("activity_level", "medium"),
                "cover_image": trip_data.get("cover_image"),
            })
        
        return JSONResponse(content={"trips": trips_list})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch trips", "details": str(e)}
        )


@app.get("/api/trip/{trip_id}")
async def get_trip(trip_id: str, user = Depends(get_current_user)):
    """Get a specific trip by ID"""
    try:
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(
                status_code=404,
                content={"error": "Trip not found"}
            )
        
        trip_data = trip_doc.to_dict()
        return JSONResponse(content=trip_data)
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch trip", "details": str(e)}
        )


@app.delete("/api/trip/{trip_id}")
async def delete_trip(trip_id: str, user = Depends(get_current_user)):
    """Delete a specific trip"""
    try:
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id)
        trip_ref.delete()
        
        return JSONResponse(content={"message": "Trip deleted successfully"})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to delete trip", "details": str(e)}
        )


class RatingRequest(BaseModel):
    rating: int


class ViewRequest(BaseModel):
    user_id: str


@app.put("/api/trip/{trip_id}/rating")
async def update_trip_rating(trip_id: str, rating_request: RatingRequest, user = Depends(get_current_user)):
    """Update the rating for a specific trip"""
    try:
        if rating_request.rating < 1 or rating_request.rating > 5:
            return JSONResponse(
                status_code=400,
                content={"error": "Rating must be between 1 and 5"}
            )
        
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(
                status_code=404,
                content={"error": "Trip not found"}
            )
        
        trip_ref.update({"rating": rating_request.rating})
        
        return JSONResponse(content={"message": "Rating updated successfully", "rating": rating_request.rating})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update rating", "details": str(e)}
        )


class CoverImageRequest(BaseModel):
    cover_image: str


@app.put("/api/trip/{trip_id}/cover-image")
async def update_trip_cover_image(trip_id: str, request: CoverImageRequest, user = Depends(get_current_user)):
    """Update the cover image for a specific trip"""
    try:
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(
                status_code=404,
                content={"error": "Trip not found"}
            )
        
        trip_data = trip_doc.to_dict()
        trip_plan = trip_data.get("trip_plan", {})
        trip_plan["cover_image"] = request.cover_image
        
        trip_ref.update({
            "trip_plan": trip_plan,
            "cover_image": request.cover_image
        })
        
        return JSONResponse(content={"message": "Cover image updated successfully"})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update cover image", "details": str(e)}
        )


# ============== Catalog Feature Endpoints ==============

class TogglePublicRequest(BaseModel):
    is_public: bool
    category_tags: Optional[list] = []
    cover_image: Optional[str] = None


@app.post("/api/trip/{trip_id}/toggle-public")
async def toggle_trip_public(trip_id: str, request: TogglePublicRequest, user = Depends(get_current_user)):
    """Toggle trip public/private status"""
    try:
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(
                status_code=404,
                content={"error": "Trip not found"}
            )
        
        update_data = {
            "is_public": request.is_public,
            "category_tags": request.category_tags,
        }
        
        if request.cover_image:
            update_data["cover_image"] = request.cover_image
        
        if request.is_public:
            update_data["published_at"] = datetime.now().isoformat()
        
        trip_ref.update(update_data)
        
        # Recalculate user badges and stats
        user_stats = calculate_user_badges(user['uid'])
        
        return JSONResponse(content={
            "message": "Trip visibility updated",
            "is_public": request.is_public,
            "user_stats": user_stats
        })
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update trip visibility", "details": str(e)}
        )


@app.get("/api/catalog/trips")
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
        # Start with base query for public trips
        # We need to query all users' trips collections
        trips_list = []
        
        # Get all users
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            # Query trips in each user's trips subcollection
            trips_ref = firebase_db.collection("users").document(user_doc.id).collection("trips")
            
            # Filter for public trips
            query = trips_ref.where("is_public", "==", True)
            
            # Apply filters
            if budget:
                query = query.where("budget", "==", budget)
            
            trips = query.stream()
            
            for trip in trips:
                trip_data = trip.to_dict()
                
                # Additional filters (client-side since Firestore has query limitations)
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
                    # Tag mapping for bilingual support
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
                    # Expand filter tags to include all equivalent versions
                    expanded_tags = []
                    for tag in tags:
                        if tag in tag_mapping:
                            expanded_tags.extend(tag_mapping[tag])
                        else:
                            expanded_tags.append(tag)
                    # Check if any trip tag matches any expanded filter tag (case-insensitive)
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
                user_info = user_doc.to_dict()
                
                trips_list.append({
                    "trip_id": trip_data.get("trip_id"),
                    "user_id": user_doc.id,
                    "username": user_info.get("displayName", "Anonymous"),
                    "photoURL": user_info.get("photoURL", ""),
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
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch catalog trips", "details": str(e)}
        )


@app.post("/api/trip/{trip_id}/view")
async def increment_trip_view(trip_id: str, request: ViewRequest):
    """Increment view count for a public trip"""
    try:
        # Find the trip across all users
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            trip_ref = firebase_db.collection("users").document(user_doc.id).collection("trips").document(trip_id)
            trip_doc = trip_ref.get()

            if trip_doc.exists:
                trip_data = trip_doc.to_dict()
                if trip_data.get("is_public", False):
                    current_views = trip_data.get("views_count", 0)
                    trip_ref.update({"views_count": current_views + 1})
                    return JSONResponse(content={"message": "View count incremented"})
        
        return JSONResponse(
            status_code=404,
            content={"error": "Public trip not found"}
        )
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to increment view count", "details": str(e)}
        )


@app.get("/api/public-trip/{trip_id}")
async def get_public_trip(trip_id: str):
    """Get a specific public trip by ID without authentication"""
    try:
        # Find the trip across all users
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            trip_ref = firebase_db.collection("users").document(user_doc.id).collection("trips").document(trip_id)
            trip_doc = trip_ref.get()
            
            if trip_doc.exists:
                trip_data = trip_doc.to_dict()
                if trip_data.get("is_public", False):
                    # Get user info
                    user_info = user_doc.to_dict()
                    trip_data["username"] = user_info.get("displayName", "Anonymous")
                    return JSONResponse(content=trip_data)
        
        return JSONResponse(
            status_code=404,
            content={"error": "Public trip not found"}
        )
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch public trip", "details": str(e)}
        )


class LikeRequest(BaseModel):
    user_id: str


@app.post("/api/trip/{trip_id}/like")
async def toggle_trip_like(trip_id: str, request: LikeRequest):
    """Toggle like for a public trip and track in user profile"""
    try:
        # Find the trip across all users
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            trip_ref = firebase_db.collection("users").document(user_doc.id).collection("trips").document(trip_id)
            trip_doc = trip_ref.get()
            
            if trip_doc.exists:
                trip_data = trip_doc.to_dict()
                if trip_data.get("is_public", False):
                    # Get user's liked trips
                    user_ref = firebase_db.collection("users").document(request.user_id)
                    user_snapshot = user_ref.get()
                    
                    if user_snapshot.exists:
                        user_data = user_snapshot.to_dict()
                        liked_trips = user_data.get("liked_trips", [])
                        
                        # Toggle like
                        if trip_id in liked_trips:
                            # Unlike
                            liked_trips.remove(trip_id)
                            current_likes = trip_data.get("likes_count", 0)
                            trip_ref.update({"likes_count": max(0, current_likes - 1)})
                            user_ref.update({"liked_trips": liked_trips})
                            return JSONResponse(content={"message": "Unliked", "likes_count": max(0, current_likes - 1), "liked": False})
                        else:
                            # Like
                            liked_trips.append(trip_id)
                            current_likes = trip_data.get("likes_count", 0)
                            trip_ref.update({"likes_count": current_likes + 1})
                            user_ref.update({"liked_trips": liked_trips})
                            return JSONResponse(content={"message": "Liked", "likes_count": current_likes + 1, "liked": True})
                    else:
                        # Create user profile and like
                        user_ref.set({"liked_trips": [trip_id]})
                        current_likes = trip_data.get("likes_count", 0)
                        trip_ref.update({"likes_count": current_likes + 1})
                        return JSONResponse(content={"message": "Liked", "likes_count": current_likes + 1, "liked": True})
        
        return JSONResponse(
            status_code=404,
            content={"error": "Public trip not found"}
        )
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to toggle like", "details": str(e)}
        )


@app.post("/api/admin/regenerate-cover-images")
async def regenerate_cover_images(force: bool = False):
    """Regenerate cover images for all public trips (force=True to update all)"""
    try:
        updated_count = 0
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            trips_ref = firebase_db.collection("users").document(user_doc.id).collection("trips")
            trips = trips_ref.where("is_public", "==", True).stream()
            
            for trip_doc in trips:
                trip_data = trip_doc.to_dict()
                
                # Update if cover_image is missing OR force=True
                if force or not trip_data.get("cover_image"):
                    destination = trip_data.get("destination", "")
                    print(f"Fetching cover image for: {destination}")
                    
                    cover_image_url = get_unsplash_image(destination)
                    
                    if cover_image_url:
                        trip_ref = firebase_db.collection("users").document(user_doc.id).collection("trips").document(trip_doc.id)
                        trip_ref.update({"cover_image": cover_image_url})
                        updated_count += 1
                        print(f"✓ Updated {destination}")
                    else:
                        print(f"⚠ No image found for {destination}")
        
        return JSONResponse(content={
            "message": f"Successfully updated {updated_count} trips with cover images",
            "updated_count": updated_count
        })
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to regenerate cover images", "details": str(e)}
        )


@app.get("/api/user/profile")
async def get_user_profile(user = Depends(get_current_user)):
    """Get user profile information"""
    try:
        user_doc = firebase_db.collection("users").document(user['uid']).get()
        
        if not user_doc.exists:
            # Create default profile
            default_profile = {
                "uid": user['uid'],
                "email": user.get('email', ''),
                "displayName": user.get('displayName', user.get('email', '').split('@')[0]),
                "photoURL": user.get('photoURL', ''),
                "bio": "",
                "location": "",
                "interests": [],
                "stats": {
                    "total_trips": 0,
                    "public_trips": 0,
                    "total_likes": 0,
                    "badges": [],
                    "stars": 0
                },
                "created_at": datetime.now().isoformat()
            }
            firebase_db.collection("users").document(user['uid']).set(default_profile)
            return JSONResponse(content=default_profile)
        
        profile_data = user_doc.to_dict()
        # Merge with auth token data
        profile_data['displayName'] = profile_data.get('displayName') or user.get('displayName', '')
        profile_data['photoURL'] = profile_data.get('photoURL') or user.get('photoURL', '')
        
        # Calculate and include user stats/badges
        user_stats = calculate_user_badges(user['uid'])
        profile_data['stats'] = user_stats
        
        # Convert ALL Firestore datetime objects to ISO strings recursively
        def convert_datetimes(obj):
            if isinstance(obj, dict):
                return {k: convert_datetimes(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_datetimes(item) for item in obj]
            elif hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return obj
        
        profile_data = convert_datetimes(profile_data)
        
        return JSONResponse(content=profile_data)
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch profile", "details": str(e)}
        )


@app.put("/api/user/profile")
async def update_user_profile(
    request: Request,
    user = Depends(get_current_user)
):
    """Update user profile information"""
    try:
        # Get JSON body
        body = await request.json()
        
        # Check if profile exists, create if not
        user_ref = firebase_db.collection("users").document(user['uid'])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # Create default profile first
            default_profile = {
                "uid": user['uid'],
                "email": user.get('email', ''),
                "displayName": user.get('displayName', user.get('email', '').split('@')[0]),
                "photoURL": user.get('photoURL', ''),
                "bio": "",
                "location": "",
                "interests": [],
                "created_at": datetime.now().isoformat()
            }
            user_ref.set(default_profile)
        
        update_data = {}
        if "displayName" in body and body["displayName"] is not None:
            update_data["displayName"] = body["displayName"]
        if "bio" in body and body["bio"] is not None:
            update_data["bio"] = body["bio"]
        if "location" in body and body["location"] is not None:
            update_data["location"] = body["location"]
        if "photoURL" in body and body["photoURL"] is not None:
            update_data["photoURL"] = body["photoURL"]
        
        update_data["updated_at"] = datetime.now().isoformat()
        
        user_ref.update(update_data)
        
        # Fetch updated profile
        updated_doc = user_ref.get()
        profile_data = updated_doc.to_dict()
        
        # Convert ALL Firestore datetime objects to ISO strings recursively
        def convert_datetimes(obj):
            if isinstance(obj, dict):
                return {k: convert_datetimes(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_datetimes(item) for item in obj]
            elif hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return obj
        
        profile_data = convert_datetimes(profile_data)
        
        return JSONResponse(content=profile_data)
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update profile", "details": str(e)}
        )


@app.get("/api/user/liked-trips")
async def get_liked_trips(user = Depends(get_current_user)):
    """Get all trips that the user has liked"""
    try:
        # Get user's liked trips from their profile
        user_doc = firebase_db.collection("users").document(user['uid']).get()
        
        if not user_doc.exists:
            return JSONResponse(content={"trips": []})
        
        user_data = user_doc.to_dict()
        liked_trip_ids = user_data.get("liked_trips", [])
        
        if not liked_trip_ids:
            return JSONResponse(content={"trips": []})
        
        # Fetch trip details
        trips = []
        users_ref = firebase_db.collection("users").stream()
        
        for user_iter in users_ref:
            for trip_id in liked_trip_ids:
                trip_ref = firebase_db.collection("users").document(user_iter.id).collection("trips").document(trip_id)
                trip_doc = trip_ref.get()
                
                if trip_doc.exists:
                    trip_data = trip_doc.to_dict()
                    if trip_data.get("is_public", False):
                        trips.append({
                            "trip_id": trip_data.get("trip_id"),
                            "destination": trip_data.get("destination"),
                            "duration": trip_data.get("duration"),
                            "trip_name": trip_data.get("trip_plan", {}).get("trip_name", ""),
                            "cover_image": trip_data.get("cover_image")
                        })
        
        return JSONResponse(content={"trips": trips})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch liked trips", "details": str(e)}
        )


# ============== Blog API Endpoints ==============

class BlogCreateRequest(BaseModel):
    title: str
    title_vi: Optional[str] = ""
    excerpt: Optional[str] = ""
    excerpt_vi: Optional[str] = ""
    content: str
    content_vi: Optional[str] = ""
    category: Optional[str] = "Travel Tips"
    tags: Optional[list] = []
    cover_image: Optional[str] = ""
    trip_id: Optional[str] = ""


@app.post("/api/blog/create")
async def create_blog_post(blog_data: BlogCreateRequest, user = Depends(get_current_user)):
    """Create a new blog post"""
    try:
        import re
        from datetime import datetime
        
        # Generate slug from title
        slug = re.sub(r'[^a-z0-9]+', '-', blog_data.title.lower()).strip('-')
        blog_id = f"{user['uid']}_{int(datetime.now().timestamp())}"
        
        # Get user info
        user_doc = firebase_db.collection("users").document(user['uid']).get()
        author_name = "Anonymous"
        if user_doc.exists:
            user_info = user_doc.to_dict()
            author_name = user_info.get("display_name", user_info.get("email", "Anonymous"))
        
        blog_post = {
            "id": blog_id,
            "user_id": user['uid'],
            "author": author_name,
            "title": blog_data.title,
            "title_vi": blog_data.title_vi or blog_data.title,
            "slug": slug,
            "excerpt": blog_data.excerpt,
            "excerpt_vi": blog_data.excerpt_vi or blog_data.excerpt,
            "content": blog_data.content,
            "content_vi": blog_data.content_vi or blog_data.content,
            "category": blog_data.category,
            "tags": blog_data.tags,
            "cover_image": blog_data.cover_image,
            "trip_id": blog_data.trip_id,
            "date": datetime.now().isoformat(),
            "views": 0,
            "likes": 0,
            "is_published": True,
        }
        
        # Save to Firestore
        firebase_db.collection("blogs").document(blog_id).set(blog_post)
        
        return JSONResponse(content={"success": True, "slug": slug, "id": blog_id})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to create blog post", "details": str(e)}
        )


class BlogGenerateRequest(BaseModel):
    trip_id: str


@app.post("/api/blog/generate-from-trip")
async def generate_blog_from_trip(request: BlogGenerateRequest, user = Depends(get_current_user)):
    """Generate blog content from a trip using AI"""
    try:
        # Fetch trip data
        trip_ref = firebase_db.collection("users").document(user['uid']).collection("trips").document(request.trip_id)
        trip_doc = trip_ref.get()
        
        if not trip_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trip_doc.to_dict()
        trip_plan = trip_data.get("trip_plan", {})
        
        # Create prompt for AI
        prompt = f"""
Bạn là một travel blogger chuyên nghiệp. Hãy viết một bài blog du lịch hấp dẫn dựa trên chuyến đi sau:

THÔNG TIN CHUYẾN ĐI:
- Điểm đến: {trip_data.get('destination')}
- Thời gian: {trip_data.get('duration')} ngày
- Tên chuyến đi: {trip_plan.get('trip_name', '')}
- Tổng quan: {trip_plan.get('overview', '')}

CÁC HOẠT ĐỘNG:
"""
        for day in trip_plan.get("days", []):
            prompt += f"\nNgày {day.get('day')}: {day.get('title')}\n"
            for activity in day.get("activities", []):
                prompt += f"- {activity.get('time')}: {activity.get('place')} - {activity.get('description')}\n"

        prompt += """

Hãy tạo nội dung blog với format JSON sau:
{
  "title": "Tiêu đề blog bằng tiếng Anh (hấp dẫn, thu hút)",
  "title_vi": "Tiêu đề blog bằng tiếng Việt",
  "excerpt": "Tóm tắt ngắn 2-3 câu bằng tiếng Anh",
  "excerpt_vi": "Tóm tắt ngắn 2-3 câu bằng tiếng Việt",
  "content": "Nội dung đầy đủ bằng tiếng Anh (dạng Markdown, 500-800 từ)",
  "content_vi": "Nội dung đầy đủ bằng tiếng Việt (dạng Markdown, 500-800 từ)",
  "tags": ["tag1", "tag2", "tag3"]
}

CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC.
"""
        
        # Call Gemini AI
        response = await model.generate_content_async(prompt)
        raw_text = response.text.strip()
        
        # Parse JSON
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        if match:
            json_str = match.group(1) or match.group(2)
            blog_content = json.loads(json_str)
            blog_content["cover_image"] = trip_data.get("cover_image", "")
            return JSONResponse(content=blog_content)
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to parse AI response"})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to generate blog", "details": str(e)}
        )


@app.get("/api/blogs")
async def get_blogs(page: int = 1, limit: int = 10):
    """Get published blog posts"""
    try:
        blogs_ref = firebase_db.collection("blogs").where("is_published", "==", True).order_by("date", direction=firestore_module.Query.DESCENDING).limit(limit)
        blogs = blogs_ref.stream()
        
        blogs_list = []
        for blog in blogs:
            blog_data = blog.to_dict()
            blogs_list.append({
                "id": blog_data.get("id"),
                "title": blog_data.get("title"),
                "title_vi": blog_data.get("title_vi"),
                "slug": blog_data.get("slug"),
                "excerpt": blog_data.get("excerpt"),
                "excerpt_vi": blog_data.get("excerpt_vi"),
                "author_id": blog_data.get("author_id"),
                "author_name": blog_data.get("author"),
                "created_at": blog_data.get("date"),
                "category": blog_data.get("category"),
                "tags": blog_data.get("tags", []),
                "cover_image": blog_data.get("cover_image"),
                "upvotes": blog_data.get("upvotes", 0),
                "downvotes": blog_data.get("downvotes", 0),
                "comments_count": blog_data.get("comments_count", 0),
            })
        
        return JSONResponse(content={"blogs": blogs_list})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch blogs", "details": str(e)}
        )


# Blog vote API
@app.post("/api/blog/{blog_id}/vote")
async def vote_blog(blog_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Upvote or downvote a blog post"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        data = await request.json()
        vote_type = data.get("vote_type")  # "up" or "down"
        
        if vote_type not in ["up", "down"]:
            return JSONResponse(status_code=400, content={"error": "Invalid vote type"})
        
        blog_ref = firebase_db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        
        if not blog_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Blog not found"})
        
        blog_data = blog_doc.to_dict()
        
        # Check if user already voted
        votes_ref = firebase_db.collection("blog_votes").where("blog_id", "==", blog_id).where("user_id", "==", user["uid"])
        existing_votes = list(votes_ref.stream())
        
        if existing_votes:
            # User already voted, update or remove vote
            existing_vote = existing_votes[0]
            existing_vote_data = existing_vote.to_dict()
            
            if existing_vote_data.get("vote_type") == vote_type:
                # Same vote, remove it (toggle off)
                firebase_db.collection("blog_votes").document(existing_vote.id).delete()
                if vote_type == "up":
                    blog_ref.update({"upvotes": max(0, blog_data.get("upvotes", 0) - 1)})
                else:
                    blog_ref.update({"downvotes": max(0, blog_data.get("downvotes", 0) - 1)})
                
                return JSONResponse(content={"message": "Vote removed", "vote_type": None})
            else:
                # Different vote, change it
                firebase_db.collection("blog_votes").document(existing_vote.id).update({"vote_type": vote_type})
                if vote_type == "up":
                    blog_ref.update({
                        "upvotes": blog_data.get("upvotes", 0) + 1,
                        "downvotes": max(0, blog_data.get("downvotes", 0) - 1)
                    })
                else:
                    blog_ref.update({
                        "downvotes": blog_data.get("downvotes", 0) + 1,
                        "upvotes": max(0, blog_data.get("upvotes", 0) - 1)
                    })
                
                return JSONResponse(content={"message": "Vote changed", "vote_type": vote_type})
        else:
            # New vote
            vote_id = f"{blog_id}_{user['uid']}"
            firebase_db.collection("blog_votes").document(vote_id).set({
                "blog_id": blog_id,
                "user_id": user["uid"],
                "vote_type": vote_type,
                "created_at": datetime.now().isoformat()
            })
            
            if vote_type == "up":
                blog_ref.update({"upvotes": blog_data.get("upvotes", 0) + 1})
            else:
                blog_ref.update({"downvotes": blog_data.get("downvotes", 0) + 1})
            
            return JSONResponse(content={"message": "Vote added", "vote_type": vote_type})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# Blog comments API
class CommentCreate(BaseModel):
    content: str

@app.get("/api/blog/{blog_id}/comments")
async def get_blog_comments(blog_id: str):
    """Get comments for a blog post"""
    try:
        comments_ref = firebase_db.collection("blog_comments").where("blog_id", "==", blog_id).order_by("created_at", direction=firestore_module.Query.DESCENDING)
        comments = comments_ref.stream()
        
        comments_list = []
        for comment in comments:
            comment_data = comment.to_dict()
            comments_list.append({
                "id": comment.id,
                "content": comment_data.get("content"),
                "user_id": comment_data.get("user_id"),
                "user_name": comment_data.get("user_name"),
                "user_photo": comment_data.get("user_photo"),
                "created_at": comment_data.get("created_at"),
                "likes": comment_data.get("likes", 0),
            })
        
        return JSONResponse(content={"comments": comments_list})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/blog/{blog_id}/comments")
async def add_blog_comment(blog_id: str, comment: CommentCreate, user: dict = Depends(get_current_user)):
    """Add a comment to a blog post"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        # Get user profile for name
        user_doc = firebase_db.collection("users").document(user["uid"]).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        comment_id = f"{blog_id}_{user['uid']}_{int(datetime.now().timestamp())}"
        comment_data = {
            "blog_id": blog_id,
            "user_id": user["uid"],
            "user_name": user_data.get("username", user.get("email", "Anonymous")),
            "user_photo": user_data.get("photo_url", ""),
            "content": comment.content,
            "created_at": datetime.now().isoformat(),
            "likes": 0,
        }
        
        firebase_db.collection("blog_comments").document(comment_id).set(comment_data)
        
        # Update comment count on blog
        blog_ref = firebase_db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        if blog_doc.exists:
            blog_ref.update({"comments_count": blog_doc.to_dict().get("comments_count", 0) + 1})
        
        return JSONResponse(content={"message": "Comment added", "comment": {**comment_data, "id": comment_id}})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/api/blog/{blog_id}/comments/{comment_id}")
async def delete_blog_comment(blog_id: str, comment_id: str, user: dict = Depends(get_current_user)):
    """Delete a comment"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        comment_ref = firebase_db.collection("blog_comments").document(comment_id)
        comment_doc = comment_ref.get()
        
        if not comment_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Comment not found"})
        
        comment_data = comment_doc.to_dict()
        if comment_data.get("user_id") != user["uid"]:
            return JSONResponse(status_code=403, content={"error": "Not authorized to delete this comment"})
        
        comment_ref.delete()
        
        # Update comment count on blog
        blog_ref = firebase_db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        if blog_doc.exists:
            blog_ref.update({"comments_count": max(0, blog_doc.to_dict().get("comments_count", 0) - 1)})
        
        return JSONResponse(content={"message": "Comment deleted"})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ============== Badges/Achievements System ==============

# Badge definitions
BADGES = {
    "explorer": {
        "id": "explorer",
        "name": "Explorer",
        "name_vi": "Nhà thám hiểm",
        "description": "Created 20+ trips",
        "description_vi": "Tạo hơn 20 chuyến đi",
        "icon": "🧭",
        "color": "bg-blue-500",
        "requirement": {"type": "trips_count", "value": 20}
    },
    "adventurer": {
        "id": "adventurer",
        "name": "Adventurer",
        "name_vi": "Nhà phiêu lưu",
        "description": "Created 10+ trips",
        "description_vi": "Tạo hơn 10 chuyến đi",
        "icon": "🎒",
        "color": "bg-green-500",
        "requirement": {"type": "trips_count", "value": 10}
    },
    "first_trip": {
        "id": "first_trip",
        "name": "First Steps",
        "name_vi": "Bước đầu tiên",
        "description": "Created your first trip",
        "description_vi": "Tạo chuyến đi đầu tiên",
        "icon": "🚀",
        "color": "bg-purple-500",
        "requirement": {"type": "trips_count", "value": 1}
    },
    "top_reviewer": {
        "id": "top_reviewer",
        "name": "Top Reviewer",
        "name_vi": "Người đánh giá hàng đầu",
        "description": "Gave 50+ ratings",
        "description_vi": "Đánh giá hơn 50 lần",
        "icon": "⭐",
        "color": "bg-yellow-500",
        "requirement": {"type": "ratings_given", "value": 50}
    },
    "local_guide": {
        "id": "local_guide",
        "name": "Local Guide",
        "name_vi": "Hướng dẫn viên địa phương",
        "description": "Tips liked 100+ times",
        "description_vi": "Tips được thích hơn 100 lần",
        "icon": "🗺️",
        "color": "bg-teal-500",
        "requirement": {"type": "tips_likes", "value": 100}
    },
    "popular": {
        "id": "popular",
        "name": "Popular Creator",
        "name_vi": "Người sáng tạo nổi tiếng",
        "description": "Trips viewed 1000+ times",
        "description_vi": "Chuyến đi được xem hơn 1000 lần",
        "icon": "🔥",
        "color": "bg-orange-500",
        "requirement": {"type": "total_views", "value": 1000}
    },
    "sharing_is_caring": {
        "id": "sharing_is_caring",
        "name": "Sharing is Caring",
        "name_vi": "Chia sẻ là quan tâm",
        "description": "Made 5+ trips public",
        "description_vi": "Công khai hơn 5 chuyến đi",
        "icon": "🌍",
        "color": "bg-indigo-500",
        "requirement": {"type": "public_trips", "value": 5}
    },
    "blogger": {
        "id": "blogger",
        "name": "Travel Blogger",
        "name_vi": "Blogger du lịch",
        "description": "Wrote 5+ blog posts",
        "description_vi": "Viết hơn 5 bài blog",
        "icon": "✍️",
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
        "total_stars": 0,  # Stars earned from public trips
    }
    
    try:
        # Count trips
        trips_ref = firebase_db.collection("trips").where("user_id", "==", user_id)
        trips = list(trips_ref.stream())
        stats["trips_count"] = len(trips)
        
        for trip in trips:
            trip_data = trip.to_dict()
            if trip_data.get("is_public"):
                stats["public_trips"] += 1
                stats["total_views"] += trip_data.get("views_count", 0)
                stats["total_likes"] += trip_data.get("likes_count", 0)
                # Each public trip earns 1 star, plus bonus for ratings
                trip_rating = trip_data.get("rating", 0)
                if trip_rating >= 4:
                    stats["total_stars"] += 2
                elif trip_rating >= 3:
                    stats["total_stars"] += 1
        
        # Count blogs
        blogs_ref = firebase_db.collection("blogs").where("author_id", "==", user_id).where("is_published", "==", True)
        blogs = list(blogs_ref.stream())
        stats["blogs_count"] = len(blogs)
        
        # Tips likes would need separate tracking - placeholder
        stats["tips_likes"] = stats["total_likes"]  # Use trip likes as proxy
        
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
            # Badge not yet trackable
            earned_badges.append({
                **badge,
                "earned": False,
                "progress": 0
            })
    
    return earned_badges


@app.get("/api/user/{user_id}/badges")
async def get_badges(user_id: str):
    """Get badges for a user"""
    try:
        badges = get_user_badges(user_id)
        stats = calculate_user_stats(user_id)
        
        earned_count = sum(1 for b in badges if b.get("earned"))
        
        return JSONResponse(content={
            "badges": badges,
            "earned_count": earned_count,
            "total_count": len(BADGES),
            "stats": stats
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/user/{user_id}/stats")
async def get_user_stats(user_id: str):
    """Get detailed stats for a user"""
    try:
        stats = calculate_user_stats(user_id)
        badges = get_user_badges(user_id)
        earned_badges = [b for b in badges if b.get("earned")]
        
        return JSONResponse(content={
            "stats": stats,
            "badges": earned_badges,
            "level": calculate_user_level(stats),
            "next_level_progress": calculate_level_progress(stats)
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


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
        return 100  # Max level
    
    current_min = levels_points[current_idx]
    next_min = levels_points[current_idx + 1]
    
    progress = ((total_points - current_min) / (next_min - current_min)) * 100
    return min(100, int(progress))


# Stars/Points reward system for public trips
@app.get("/api/user/{user_id}/rewards")
async def get_user_rewards(user_id: str):
    """Get user's reward points and available rewards"""
    try:
        stats = calculate_user_stats(user_id)
        
        # Calculate total stars/points
        total_stars = stats.get("total_stars", 0)
        
        # Get user's redeemed rewards
        rewards_ref = firebase_db.collection("user_rewards").where("user_id", "==", user_id)
        redeemed = list(rewards_ref.stream())
        redeemed_ids = [r.to_dict().get("reward_id") for r in redeemed]
        
        # Available rewards
        available_rewards = [
            {"id": "premium_badge", "name": "Premium Badge", "name_vi": "Huy hiệu cao cấp", "cost": 50, "icon": "🏆"},
            {"id": "featured_trip", "name": "Feature a Trip", "name_vi": "Nổi bật chuyến đi", "cost": 100, "icon": "⭐"},
            {"id": "custom_avatar", "name": "Custom Avatar Frame", "name_vi": "Khung avatar", "cost": 75, "icon": "🖼️"},
            {"id": "early_access", "name": "Early Access Features", "name_vi": "Tính năng sớm", "cost": 200, "icon": "🚀"},
        ]
        
        return JSONResponse(content={
            "total_stars": total_stars,
            "available_rewards": available_rewards,
            "redeemed_rewards": redeemed_ids,
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/user/redeem-reward")
async def redeem_reward(request: Request, user: dict = Depends(get_current_user)):
    """Redeem a reward using stars"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        data = await request.json()
        reward_id = data.get("reward_id")
        
        stats = calculate_user_stats(user["uid"])
        total_stars = stats.get("total_stars", 0)
        
        rewards_cost = {
            "premium_badge": 50,
            "featured_trip": 100,
            "custom_avatar": 75,
            "early_access": 200,
        }
        
        if reward_id not in rewards_cost:
            return JSONResponse(status_code=400, content={"error": "Invalid reward"})
        
        cost = rewards_cost[reward_id]
        
        if total_stars < cost:
            return JSONResponse(status_code=400, content={"error": "Not enough stars"})
        
        # Check if already redeemed
        existing = firebase_db.collection("user_rewards").where("user_id", "==", user["uid"]).where("reward_id", "==", reward_id).get()
        if list(existing):
            return JSONResponse(status_code=400, content={"error": "Already redeemed"})
        
        # Record redemption
        firebase_db.collection("user_rewards").add({
            "user_id": user["uid"],
            "reward_id": reward_id,
            "cost": cost,
            "redeemed_at": datetime.now().isoformat()
        })
        
        # Deduct stars (would need to track spent stars separately)
        user_ref = firebase_db.collection("users").document(user["uid"])
        user_doc = user_ref.get()
        if user_doc.exists:
            current_spent = user_doc.to_dict().get("spent_stars", 0)
            user_ref.update({"spent_stars": current_spent + cost})
        
        return JSONResponse(content={"message": "Reward redeemed successfully"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

