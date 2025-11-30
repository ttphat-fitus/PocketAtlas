import google.generativeai as genai
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import json
import re
import requests
from typing import Optional
from datetime import datetime
from firebase_config import firebase_db
from auth_middleware import get_current_user, get_optional_user
from google.cloud import firestore as firestore_module

GOOGLE_API_KEY = json.load(open("key/chatbot_key.json"))["GOOGLE_API_KEY"]
GOOGLE_MAPS_API_KEY = json.load(open("key/maps_key.json"))["GOOGLE_MAPS_API_KEY"]
WEATHER_API_KEY = json.load(open("key/weather_key.json"))["WeatherAPIKey"]

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
def get_weather_forecast(lat: float, lng: float) -> dict:
    """Get 3-day weather forecast using WeatherAPI for detailed conditions"""
    try:
        from datetime import datetime, timedelta
        
        # Get today's date
        today = datetime.now()
        
        # WeatherAPI endpoint
        url = "http://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHER_API_KEY,
            "q": f"{lat},{lng}",
            "days": 3,  # 3-day forecast
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
        
        # Step 1: Google Places Text Search
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        search_params = {
            "query": f"{q} {location}",
            "key": GOOGLE_MAPS_API_KEY,
            "language": "vi"
        }
        
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
            "google_maps_link": google_maps_link
        }
    
    except Exception as e:
        print(f"Error fetching Google Maps API for '{place_name}': {e}")
        return {
            "name": place_name, "address": "", "rating": 0, "total_ratings": 0,
            "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0,
            "weather": {"forecasts": []}, "phone": "", "website": "", "opening_hours": [],
            "reviews": [], "google_maps_link": ""
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
    
    # Get weather forecast for destination to guide suggestions
    weather_context = ""
    try:
        # Get approximate coordinates for destination (simplified)
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        geocode_params = {"address": trip_request.destination, "key": GOOGLE_MAPS_API_KEY}
        geo_resp = requests.get(geocode_url, params=geocode_params, timeout=5)
        geo_data = geo_resp.json()
        
        if geo_data.get("results"):
            location = geo_data["results"][0]["geometry"]["location"]
            weather_data = get_weather_forecast(location["lat"], location["lng"])
            forecasts = weather_data.get("forecasts", [])
            
            if forecasts:
                weather_context = "\n\nDỰ BÁO THỜI TIẾT:\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                for i, fc in enumerate(forecasts, 1):
                    weather_context += f"• Ngày {i} ({fc['date']}): {fc['condition']}, {fc['temp_min']}-{fc['temp_max']}°C, "
                    weather_context += f"Độ ẩm {fc['humidity']}%, Khả năng mưa {fc['rain_chance']}%\n"
                    weather_context += f"  → {fc['suggestion']}\n"
                
                weather_context += "\n⚠️ QUAN TRỌNG: Dựa vào thời tiết để điều chỉnh hoạt động:\n"
                weather_context += "- Nếu MƯA/MƯA TO → Ưu tiên hoạt động TRONG NHÀ (bảo tàng, chợ trong nhà, quán cà phê, massage/spa)\n"
                weather_context += "- Nếu NẮNG/QUANG ĐÃNG → Ưu tiên hoạt động NGOÀI TRỜI (tham quan, chụp ảnh, bãi biển, đi bộ)\n"
                weather_context += "- Nếu NHIỀU MÂY → Kết hợp cả hai loại hoạt động\n"
    except Exception as e:
        print(f"Could not fetch weather for destination: {e}")
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
   - Ngân sách LOW: 50,000-150,000 VND/hoạt động
   - Ngân sách MEDIUM: 150,000-500,000 VND/hoạt động  
   - Ngân sách HIGH: 500,000-2,000,000 VND/hoạt động

4. **Đa dạng hoạt động**: Văn hóa, ẩm thực, thiên nhiên, giải trí, mua sắm

5. **Tips THỰC TIỄN**: Thời gian tốt nhất, cách di chuyển, lưu ý đặc biệt

6. **CHI PHÍ FORMAT**: Chỉ ghi số tiền và đơn vị VND, KHÔNG thêm mô tả trong ngoặc đơn
   - ĐÚNG: "100.000 - 200.000 VND" hoặc "50.000 VND"
   - SAI: "100.000 - 200.000 VND (vé vào cửa + ăn sáng)"

FORMAT JSON (CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{
  "trip_name": "Tên chuyến đi hấp dẫn (VD: 'Khám Phá Hà Nội - Hành Trình Nghìn Năm Văn Hiến')",
  "overview": "Tổng quan 2-3 câu về điểm nổi bật của chuyến đi",
  "total_estimated_cost": "5.000.000 - 7.000.000 VND",
  "days": [
    {{
      "day": 1,
      "title": "Tiêu đề cho ngày 1 (VD: 'Khám phá Old Quarter & Văn hóa cổ đô')",
      "activities": [
        {{
          "time": "08:00 - 10:00",
          "place": "Hồ Hoàn Kiếm",
          "description": "Mô tả hoạt động chi tiết: làm gì, trải nghiệm gì, ăn gì, chi phí gồm những gì",
          "estimated_cost": "100.000 - 200.000 VND",
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
        "version": "1.0.0",
        "endpoints": {
            "plan_trip": "/api/plan-trip (POST)",
            "docs": "/docs"
        }
    }


@app.post("/api/plan-trip")
async def plan_trip(trip_request: TripRequest, user = Depends(get_optional_user)):
    """Main endpoint: Generate personalized travel itinerary and save to Firestore"""
    try:
        print(f"\nCreating trip plan for: {trip_request.destination}")
        print(f"Duration: {trip_request.duration} days | Budget: {trip_request.budget}")
        
        trip_prompt = create_trip_planning_prompt(trip_request)
        
        print("Calling Gemini AI...")
        response = await model.generate_content_async(trip_prompt)
        raw_text = response.text.strip()
        
        print("Parsing JSON response...")
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        
        if not match:
            print("⚠️ JSON not found in response")
            return JSONResponse(
                status_code=500,
                content={"error": "AI không trả về định dạng JSON hợp lệ", "raw": raw_text[:500]}
            )
        
        json_str = match.group(1) or match.group(2)
        trip_plan = json.loads(json_str)
        
        # Get destination weather forecast for trip dates
        destination_weather = []
        try:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geocode_params = {"address": trip_request.destination, "key": GOOGLE_MAPS_API_KEY}
            geo_resp = requests.get(geocode_url, params=geocode_params, timeout=5)
            geo_data = geo_resp.json()
            
            if geo_data.get("results"):
                location = geo_data["results"][0]["geometry"]["location"]
                weather_data = get_weather_forecast(location["lat"], location["lng"])
                forecasts = weather_data.get("forecasts", [])
                
                # Match weather to trip dates
                from datetime import datetime, timedelta
                start_date = datetime.strptime(trip_request.start_date, "%Y-%m-%d")
                
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
        except Exception as e:
            print(f"Could not fetch destination weather: {e}")
        
        # Add weather to trip plan for user display
        trip_plan["weather_forecast"] = destination_weather
        
        print("Enriching with Google Places API...")
        total_activities = sum(len(day.get("activities", [])) for day in trip_plan.get("days", []))
        processed = 0
        
        for day in trip_plan.get("days", []):
            for activity in day.get("activities", []):
                place_name = activity.get("place", "")
                if place_name:
                    processed += 1
                    print(f"  [{processed}/{total_activities}] Fetching: {place_name}")
                    
                    place_details = await run_in_threadpool(
                        get_place_details,
                        place_name,
                        trip_request.destination
                    )
                    activity["place_details"] = place_details
                    
                    # Log address for debugging
                    if place_details.get("address"):
                        print(f"      ✓ Address: {place_details['address'][:60]}...")
                    else:
                        print(f"      ⚠ No address found")
        
        print(f"Trip plan generated successfully with {total_activities} activities!")
        
        # Save trip to Firestore if user is authenticated
        trip_id = None
        if user:
            trip_id = f"{user['uid']}_{int(datetime.now().timestamp())}"
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
                # Catalog feature fields
                "is_public": False,
                "views_count": 0,
                "likes_count": 0,
                "category_tags": trip_request.categories or [],
                "cover_image": None,
            }
            
            # Save to user's trips subcollection
            firebase_db.collection("users").document(user['uid']).collection("trips").document(trip_id).set(trip_data)
            print(f"✓ Trip saved to Firestore: {trip_id}")
            
            # Add trip_id to response
            trip_plan["trip_id"] = trip_id
        
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
        
        return JSONResponse(content={
            "message": "Trip visibility updated",
            "is_public": request.is_public
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
                    tags = [t.strip() for t in category_tags.split(",")]
                    trip_tags = trip_data.get("category_tags", [])
                    if not any(tag in trip_tags for tag in tags):
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
                    "rating": trip_data.get("rating", 0),
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
async def increment_trip_view(trip_id: str, user_id: str):
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


@app.post("/api/trip/{trip_id}/like")
async def toggle_trip_like(trip_id: str, user_id: str):
    """Toggle like for a public trip"""
    try:
        # Find the trip across all users
        users_ref = firebase_db.collection("users").stream()
        
        for user_doc in users_ref:
            trip_ref = firebase_db.collection("users").document(user_doc.id).collection("trips").document(trip_id)
            trip_doc = trip_ref.get()
            
            if trip_doc.exists:
                trip_data = trip_doc.to_dict()
                if trip_data.get("is_public", False):
                    # Check if user already liked (you could store this in a separate collection)
                    # For simplicity, just toggle the count
                    current_likes = trip_data.get("likes_count", 0)
                    trip_ref.update({"likes_count": max(0, current_likes + 1)})
                    return JSONResponse(content={"message": "Like toggled", "likes_count": current_likes + 1})
        
        return JSONResponse(
            status_code=404,
            content={"error": "Public trip not found"}
        )
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to toggle like", "details": str(e)}
        )
