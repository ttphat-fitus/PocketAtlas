"""Maps and location services using Google Maps API"""
import httpx
import requests
import re
import asyncio
import math
from typing import Optional
from urllib.parse import quote
from core.config import GOOGLE_MAPS_API_KEY
from services.weather import get_weather_forecast


def _looks_like_hotel_query(place_name: str, place_type_hint: Optional[str] = None) -> bool:
    hint = (place_type_hint or "").strip().lower()
    if hint in ["lodging", "hotel"]:
        return True
    q = (place_name or "").lower()
    return any(k in q for k in [
        "hotel",
        "khách sạn",
        "khach san",
        "resort",
        "homestay",
        "hostel",
        "villa",
        "motel",
    ])


async def async_geocode(address: str) -> dict:
    """Async geocoding to get coordinates for an address"""
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": address, "key": GOOGLE_MAPS_API_KEY}
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(url, params=params)
            data = response.json()
            
            if data.get("results"):
                location = data["results"][0]["geometry"]["location"]
                return {"lat": location["lat"], "lng": location["lng"]}
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return {"lat": 0, "lng": 0}


def sanitize_place_name(s: str) -> str:
    """Sanitize place name for API search"""
    if not s:
        return ""
    s = re.sub(r'\(.*?VD:.*?\)', '', s, flags=re.IGNORECASE)
    s = re.sub(r'VD:\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[\(\)\[\]\"…\n\r]', ' ', s)
    s = re.sub(r'[^0-9A-Za-zÀ-ỹ\s\-\,\.]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometers."""
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def get_place_details(place_name: str, location: str, place_type_hint: Optional[str] = None) -> dict:
    """Enhanced place details using Google Maps API with weather, photos, ratings, and more"""
    empty_result = {
        "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
        "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
        "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
        "reviews": [], "google_maps_link": "", "booking_link": "", "is_hotel": False
    }
    
    try:
        q = sanitize_place_name(place_name)
        if not q or len(q) < 3:
            return empty_result
        
        headers = {"User-Agent": "PocketAtlas/1.0"}
        
        # Get location coordinates for bias
        location_bias = ""
        bias_center = None
        try:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geocode_params = {
                "address": location,
                "key": GOOGLE_MAPS_API_KEY,
                "language": "vi",
                "region": "vn",
                "components": "country:vn",
            }
            geocode_resp = requests.get(geocode_url, params=geocode_params, timeout=5)
            geocode_data = geocode_resp.json()
            if geocode_data.get("results"):
                geo_loc = geocode_data["results"][0]["geometry"]["location"]
                bias_center = (float(geo_loc.get("lat", 0)), float(geo_loc.get("lng", 0)))
                if bias_center[0] and bias_center[1]:
                    # Prefer a radius bias (helps avoid cross-city same-name branches)
                    location_bias = f"circle:35000@{bias_center[0]},{bias_center[1]}"
        except:
            pass
        
        # Step 1: Google Places Text Search
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        search_params = {
            "query": f"{q} {location}",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi",
            "region": "vn",
        }

        if _looks_like_hotel_query(place_name, place_type_hint):
            search_params["type"] = "lodging"
        
        if location_bias:
            search_params["locationbias"] = location_bias
        
        resp = requests.get(search_url, params=search_params, timeout=10, headers=headers)
        data = resp.json()
        
        if data.get("status") != "OK" or not data.get("results"):
            print(f"      Google Places API error: {data.get('status')}")
            return empty_result

        # Prefer the result closest to destination center (when available)
        results = data.get("results", [])[:5]
        place = results[0]
        if bias_center and results:
            best = None
            best_dist = None
            for cand in results:
                cand_loc = cand.get("geometry", {}).get("location", {})
                try:
                    clat = float(cand_loc.get("lat", 0))
                    clng = float(cand_loc.get("lng", 0))
                except Exception:
                    continue
                if not clat or not clng:
                    continue
                d = _haversine_km(bias_center[0], bias_center[1], clat, clng)
                if best is None or (best_dist is not None and d < best_dist):
                    best = cand
                    best_dist = d
            if best is not None:
                place = best

        place_id = place.get("place_id")
        location_data = place.get("geometry", {}).get("location", {})
        lat = float(location_data.get("lat", 0))
        lng = float(location_data.get("lng", 0))
        
        # Step 2: Get Place Details
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            "place_id": place_id,
            "fields": "name,formatted_address,rating,user_ratings_total,photos,geometry,types,price_level,formatted_phone_number,website,opening_hours,reviews",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi"
        }
        
        details_resp = requests.get(details_url, params=details_params, timeout=10, headers=headers)
        details_data = details_resp.json()
        place_details = details_data.get("result", place) if details_data.get("status") == "OK" else place

        # Prefer the precise geometry from Place Details (Text Search can be less accurate)
        try:
            details_loc = place_details.get("geometry", {}).get("location", {})
            dlat = float(details_loc.get("lat", 0)) if details_loc.get("lat") is not None else 0
            dlng = float(details_loc.get("lng", 0)) if details_loc.get("lng") is not None else 0
            if dlat and dlng:
                lat, lng = dlat, dlng
        except Exception:
            pass
        
        # Extract photo URL
        photo_url = ""
        photos = place_details.get("photos", [])
        if photos:
            photo_reference = photos[0].get("photo_reference")
            photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_reference}&key={GOOGLE_MAPS_API_KEY}"
        
        # Get weather forecast
        weather_data = get_weather_forecast(lat, lng) if lat != 0 and lng != 0 else {"forecasts": []}
        
        # Extract reviews
        reviews = []
        for review in place_details.get("reviews", [])[:3]:
            text = review.get("text", "")
            reviews.append({
                "author": review.get("author_name", "Anonymous"),
                "rating": review.get("rating", 0),
                "text": text[:200] + "..." if len(text) > 200 else text,
                "time": review.get("relative_time_description", "")
            })
        
        # Opening hours
        opening_hours = place_details.get("opening_hours", {}).get("weekday_text", [])
        
        # Generate Google Maps link
        google_maps_link = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={place_id}" if lat != 0 else ""
        
        # Check if hotel and generate Booking.com link
        place_types = place_details.get("types", [])
        is_hotel = any(t in place_types for t in ["lodging", "hotel", "resort", "guest_house", "motel"]) or _looks_like_hotel_query(place_name, place_type_hint)
        booking_link = (
            f"https://www.booking.com/searchresults.html?ss={quote(place_details.get('name', place_name) + ' ' + location)}"
            if is_hotel
            else ""
        )
        
        return {
            "name": place_details.get("name", place_name),
            "address": place_details.get("formatted_address", ""),
            "rating": place_details.get("rating", 0),
            "total_ratings": place_details.get("user_ratings_total", 0),
            "photo_url": photo_url,
            "lat": lat,
            "lng": lng,
            "types": place_types,
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
        print(f"Error fetching place details for '{place_name}': {e}")
        return empty_result


async def get_place_details_async(place_name: str, location: str, location_coords: dict = None, place_type_hint: Optional[str] = None) -> dict:
    """Async version of get_place_details"""
    empty_result = {
        "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
        "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
        "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
        "reviews": [], "google_maps_link": "", "booking_link": "", "is_hotel": False
    }

    try:
        q = sanitize_place_name(place_name)
        if not q or len(q) < 3:
            return empty_result
        
        async with httpx.AsyncClient(timeout=15) as client:
            location_bias = ""
            bias_center = None
            if location_coords and location_coords.get("lat"):
                bias_center = (float(location_coords.get("lat", 0)), float(location_coords.get("lng", 0)))
                if bias_center[0] and bias_center[1]:
                    location_bias = f"circle:35000@{bias_center[0]},{bias_center[1]}"
            else:
                try:
                    geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
                    geocode_params = {
                        "address": location,
                        "key": GOOGLE_MAPS_API_KEY,
                        "language": "vi",
                        "region": "vn",
                        "components": "country:vn",
                    }
                    geocode_resp = await client.get(geocode_url, params=geocode_params)
                    geocode_data = geocode_resp.json()
                    if geocode_data.get("results"):
                        geo_loc = geocode_data["results"][0]["geometry"]["location"]
                        bias_center = (float(geo_loc.get("lat", 0)), float(geo_loc.get("lng", 0)))
                        if bias_center[0] and bias_center[1]:
                            location_bias = f"circle:35000@{bias_center[0]},{bias_center[1]}"
                except:
                    pass
            
            search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            search_params = {
                "query": f"{q} {location}",
                "key": GOOGLE_MAPS_API_KEY,
                "language": "vi",
                "region": "vn",
            }
            if location_bias:
                search_params["locationbias"] = location_bias

            if _looks_like_hotel_query(place_name, place_type_hint):
                search_params["type"] = "lodging"
            
            resp = await client.get(search_url, params=search_params)
            data = resp.json()
            
            if data.get("status") != "OK" or not data.get("results"):
                return empty_result

            results = data.get("results", [])[:5]
            place = results[0]
            if bias_center and results:
                best = None
                best_dist = None
                for cand in results:
                    cand_loc = cand.get("geometry", {}).get("location", {})
                    try:
                        clat = float(cand_loc.get("lat", 0))
                        clng = float(cand_loc.get("lng", 0))
                    except Exception:
                        continue
                    if not clat or not clng:
                        continue
                    d = _haversine_km(bias_center[0], bias_center[1], clat, clng)
                    if best is None or (best_dist is not None and d < best_dist):
                        best = cand
                        best_dist = d
                if best is not None:
                    place = best

            place_id = place.get("place_id")
            location_data = place.get("geometry", {}).get("location", {})
            lat = float(location_data.get("lat", 0))
            lng = float(location_data.get("lng", 0))
            
            details_url = "https://maps.googleapis.com/maps/api/place/details/json"
            details_params = {
                "place_id": place_id,
                "fields": "name,formatted_address,rating,user_ratings_total,photos,geometry,types,price_level,formatted_phone_number,website,opening_hours,reviews",
                "key": GOOGLE_MAPS_API_KEY,
                "language": "vi"
            }
            
            details_resp = await client.get(details_url, params=details_params)
            details_data = details_resp.json()
            place_details = details_data.get("result", place) if details_data.get("status") == "OK" else place

        # Prefer the precise geometry from Place Details (Text Search can be less accurate)
        try:
            details_loc = place_details.get("geometry", {}).get("location", {})
            dlat = float(details_loc.get("lat", 0)) if details_loc.get("lat") is not None else 0
            dlng = float(details_loc.get("lng", 0)) if details_loc.get("lng") is not None else 0
            if dlat and dlng:
                lat, lng = dlat, dlng
        except Exception:
            pass
        
        photo_url = ""
        photos = place_details.get("photos", [])
        if photos:
            photo_reference = photos[0].get("photo_reference")
            photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_reference}&key={GOOGLE_MAPS_API_KEY}"
        
        reviews = []
        for review in place_details.get("reviews", [])[:3]:
            text = review.get("text", "")
            reviews.append({
                "author": review.get("author_name", "Anonymous"),
                "rating": review.get("rating", 0),
                "text": text[:200] + "..." if len(text) > 200 else text,
                "time": review.get("relative_time_description", "")
            })
        
        opening_hours = place_details.get("opening_hours", {}).get("weekday_text", [])
        google_maps_link = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={place_id}" if lat != 0 else ""
        
        place_types = place_details.get("types", [])
        is_hotel = any(t in place_types for t in ["lodging", "hotel", "resort", "guest_house", "motel"]) or _looks_like_hotel_query(place_name, place_type_hint)
        booking_link = (
            f"https://www.booking.com/searchresults.html?ss={quote(place_details.get('name', place_name) + ' ' + location)}"
            if is_hotel
            else ""
        )
        
        return {
            "name": place_details.get("name", place_name),
            "address": place_details.get("formatted_address", ""),
            "rating": place_details.get("rating", 0),
            "total_ratings": place_details.get("user_ratings_total", 0),
            "photo_url": photo_url,
            "lat": lat,
            "lng": lng,
            "types": place_types,
            "price_level": place_details.get("price_level", 0),
            "weather": {"forecasts": []},
            "phone": place_details.get("formatted_phone_number", ""),
            "website": place_details.get("website", ""),
            "opening_hours": opening_hours,
            "reviews": reviews,
            "google_maps_link": google_maps_link,
            "booking_link": booking_link,
            "is_hotel": is_hotel
        }
    
    except Exception as e:
        print(f"Error fetching place details (async) for '{place_name}': {e}")
        return empty_result


async def enrich_activities_parallel(trip_plan: dict, destination: str, batch_size: int = 5) -> dict:
    """Enrich all activities with place details in parallel batches"""
    location_coords = await async_geocode(destination)

    empty_result = {
        "name": "",
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
    
    all_activities = []
    for day in trip_plan.get("days", []):
        for activity in day.get("activities", []):
            if activity.get("place"):
                all_activities.append(activity)
    
    total_activities = len(all_activities)
    print(f"Enriching {total_activities} activities in parallel batches of {batch_size}...")
    
    for batch_start in range(0, total_activities, batch_size):
        batch_end = min(batch_start + batch_size, total_activities)
        batch = all_activities[batch_start:batch_end]
        
        print(f"  Batch {batch_start // batch_size + 1}: Processing activities {batch_start + 1}-{batch_end}")
        
        tasks = [
            get_place_details_async(activity.get("place", ""), destination, location_coords)
            for activity in batch
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"    Error for {batch[i].get('place', 'unknown')}: {result}")
                batch[i]["place_details"] = empty_result
            else:
                batch[i]["place_details"] = result
                if result.get("address"):
                    print(f"    {batch[i].get('place', 'unknown')[:30]}...")
    
    print(f"Enriched {total_activities} activities successfully!")
    return trip_plan


def generate_booking_link(destination: str, checkin: str, checkout: str, guests: int = 2) -> str:
    """Generate a Booking.com search link"""
    from urllib.parse import urlencode
    
    base_url = "https://www.booking.com/searchresults.html"
    params = {
        "ss": destination,
        "checkin": checkin,
        "checkout": checkout,
        "group_adults": guests,
        "no_rooms": 1,
        "group_children": 0,
    }
    return f"{base_url}?{urlencode(params)}"
