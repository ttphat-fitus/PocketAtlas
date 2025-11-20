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
TRACKASIA_API_KEY = json.load(open("key/places_key.json"))["TRACK_ASIA_KEY"]

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
    'gemini-2.0-flash-exp',
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

# ============== Helper Functions ==============
def get_place_details(place_name: str, location: str) -> dict:
    def sanitize(s: str) -> str:
        if not s:
            return ""
        # Remove example markers like "(VD: Restaurant Name)"
        s = re.sub(r'\(.*?VD:.*?\)', '', s, flags=re.IGNORECASE)
        s = re.sub(r'VD:\s*', '', s, flags=re.IGNORECASE)
        # Remove parentheses and brackets
        s = re.sub(r'[\(\)\[\]\"…\n\r]', ' ', s)
        # Keep Vietnamese letters, numbers, basic punctuation
        s = re.sub(r'[^0-9A-Za-zÀ-ỹ\s\-\,\.]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s

    try:
        q = sanitize(place_name)
        if not q or len(q) < 3:  # Skip if name is too short or empty
            return {"name": place_name, "address": "", "rating": 0, "total_ratings": 0, "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0}
        
        # Try multiple query variations for better matching
        queries = [
            f"{q} {location}".strip(),  # Most specific
            f"{q}, {location}".strip(),  # Alternative format
            q  # Just the place name
        ]
        
        headers = {"User-Agent": "PocketAtlas/1.0"}
        
        # Strategy 1: TrackAsia Search API (best for landmarks, restaurants)
        for query in queries:
            if not query:
                continue
            
            # TrackAsia Search API endpoint (v2 - compatible with Google Places format)
            search_url = "https://maps.track-asia.com/api/v2/place/textsearch/json"
            search_params = {
                "query": query,
                "key": TRACKASIA_API_KEY,
                "language": "vi"
            }
            
            resp = requests.get(search_url, params=search_params, timeout=10, headers=headers)
            data = resp.json()
            
            results = data.get("results", [])
            print(f"      → TrackAsia Search '{query[:50]}...' → {len(results)} results")
            
            if results and len(results) > 0:
                place = results[0]
                
                # TrackAsia v2 follows Google Places API format
                # Extract basic info (no photos/ratings in free tier)
                geometry = place.get("geometry", {})
                location = geometry.get("location", {})
                
                return {
                    "name": place.get("name", place_name),
                    "address": place.get("formatted_address", ""),
                    "rating": place.get("rating", 0),  # May be 0 in free tier
                    "total_ratings": place.get("user_ratings_total", 0),
                    "photo_url": "",  # TrackAsia free tier doesn't include photos
                    "lat": float(location.get("lat", 0)),
                    "lng": float(location.get("lng", 0)),
                    "types": place.get("types", []),
                    "price_level": place.get("price_level", 0)
                }
        
        # Strategy 2: TrackAsia Nearby Search (fallback for generic location queries)
        nearby_url = "https://maps.track-asia.com/api/v2/place/textsearch/json"
        nearby_params = {
            "query": f"{q} {location}".strip(),
            "key": TRACKASIA_API_KEY,
            "language": "vi"
        }
        
        fresp = requests.get(nearby_url, params=nearby_params, timeout=8, headers=headers)
        fdata = fresp.json()
        
        fresults = fdata.get("results", [])
        print(f"      → TrackAsia Nearby Search → {len(fresults)} results")
        
        if fresults and len(fresults) > 0:
            # Try to find best match
            best_match = None
            for result in fresults:
                if q.lower() in result.get("name", "").lower():
                    best_match = result
                    break
            
            if not best_match:
                best_match = fresults[0]
            
            geometry = best_match.get("geometry", {})
            location_data = geometry.get("location", {})
            
            return {
                "name": best_match.get("name", place_name),
                "address": best_match.get("formatted_address", ""),
                "rating": best_match.get("rating", 0),
                "total_ratings": best_match.get("user_ratings_total", 0),
                "photo_url": "",
                "lat": float(location_data.get("lat", 0)),
                "lng": float(location_data.get("lng", 0)),
                "types": best_match.get("types", []),
                "price_level": best_match.get("price_level", 0)
            }
        
        # Strategy 3: TrackAsia Autocomplete (last resort for partial matches)
        autocomplete_url = "https://maps.track-asia.com/api/v2/place/autocomplete/json"
        autocomplete_params = {
            "input": f"{q} {location}".strip(),
            "key": TRACKASIA_API_KEY,
            "language": "vi"
        }
        
        gresp = requests.get(autocomplete_url, params=autocomplete_params, timeout=8, headers=headers)
        gdata = gresp.json()
        
        predictions = gdata.get("predictions", [])
        print(f"      → TrackAsia Autocomplete → {len(predictions)} predictions")
        
        if predictions and len(predictions) > 0:
            # Use first prediction
            pred = predictions[0]
            # Note: autocomplete doesn't return full coordinates, just description
            # Return basic info with name only
            return {
                "name": pred.get("description", place_name).split(",")[0].strip(),
                "address": pred.get("description", ""),
                "rating": 0,
                "total_ratings": 0,
                "photo_url": "",
                "lat": 0,  # Autocomplete doesn't provide coordinates
                "lng": 0,
                "types": pred.get("types", []),
                "price_level": 0
            }
        
        # No results from any strategy
        return {"name": place_name, "address": "", "rating": 0, "total_ratings": 0, "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0}
    
    except Exception as e:
        print(f"Error fetching TrackAsia API for '{place_name}': {e}")
        return {"name": place_name, "address": "", "rating": 0, "total_ratings": 0, "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0}


def create_trip_planning_prompt(trip_request: TripRequest) -> str:
    """Create a specialized prompt for Gemini AI to generate travel itineraries"""
    
    budget_context = {
        "low": "tiết kiệm (ưu tiên địa điểm miễn phí, ăn uống bình dân, di chuyển bằng phương tiện công cộng)",
        "medium": "trung bình (cân bằng giữa chất lượng và chi phí, ăn uống đa dạng, di chuyển linh hoạt)",
        "high": "cao cấp (ưu tiên trải nghiệm sang trọng, resort 4-5 sao, nhà hàng cao cấp, di chuyển riêng tư)"
    }
    
    budget_desc = budget_context.get(trip_request.budget, "trung bình")
    
    prompt = f"""
Bạn là một chuyên gia tư vấn du lịch chuyên nghiệp với 15 năm kinh nghiệm trong việc lập kế hoạch du lịch tại Việt Nam và thế giới.

NHIỆM VỤ: Tạo một kế hoạch du lịch chi tiết, thực tế và hấp dẫn
THÔNG TIN CHUYẾN ĐI:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Địa điểm: {trip_request.destination}
• Thời gian: {trip_request.duration} ngày
• Ngày bắt đầu: {trip_request.start_date}
• Ngân sách: {budget_desc}
• Sở thích: {trip_request.preferences if trip_request.preferences else "Du lịch tổng hợp"}

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

FORMAT JSON (CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{
  "trip_name": "Tên chuyến đi hấp dẫn (VD: 'Khám Phá Hà Nội - Hành Trình Nghìn Năm Văn Hiến')",
  "overview": "Tổng quan 2-3 câu về điểm nổi bật của chuyến đi",
  "total_estimated_cost": "Chi phí tổng ước tính (VD: '5.000.000 - 7.000.000 VND')",
  "days": [
    {{
      "day": 1,
      "title": "Tiêu đề cho ngày 1 (VD: 'Khám phá Old Quarter & Văn hóa cổ đô')",
      "activities": [
        {{
          "time": "08:00 - 10:00",
          "place": "Hồ Hoàn Kiếm",
          "description": "Mô tả hoạt động chi tiết: làm gì, trải nghiệm gì, ăn gì",
          "estimated_cost": "100.000 - 200.000 VND (vé vào cửa + ăn sáng)",
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
                "trip_plan": trip_plan,
                "created_at": datetime.now().isoformat(),
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
