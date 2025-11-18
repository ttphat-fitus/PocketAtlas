"""
Pocket Atlas - AI Travel Planner Backend
Specialized API for creating personalized travel itineraries using Gemini AI and Google Places API
"""

import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import json
import re
import requests
from typing import Optional

GOOGLE_API_KEY = json.load(open("key/chatbot_key.json"))["GOOGLE_API_KEY"]
PLACES_API_KEY = json.load(open("key/places_key.json"))["GOOGLE_PLACES_API"]

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
    """
    Fetch detailed information about a place using multiple Google Places strategies
    - Sanitize AI-generated place names (remove examples, parentheses)
    - Try Text Search → Find Place → Geocoding as fallback
    - Return structured details with address, coordinates, photos, ratings
    """
    def sanitize(s: str) -> str:
        """Remove examples (VD:), parentheses, special chars from AI-generated names"""
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
        
        # Strategy 1: Text Search (best for landmarks, restaurants)
        for query in queries:
            if not query:
                continue
            
            search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            search_params = {
                "query": query,
                "key": PLACES_API_KEY,
                "language": "vi"
            }
            
            resp = requests.get(search_url, params=search_params, timeout=10, headers=headers)
            data = resp.json()
            
            print(f"      → TextSearch '{query[:50]}...' → {len(data.get('results', []))} results")
            
            if data.get("results") and len(data["results"]) > 0:
                place = data["results"][0]
                place_id = place.get("place_id")
                
                # Fetch detailed information
                details_url = "https://maps.googleapis.com/maps/api/place/details/json"
                details_params = {
                    "place_id": place_id,
                    "fields": "name,formatted_address,rating,user_ratings_total,photos,geometry,types,price_level",
                    "key": PLACES_API_KEY,
                    "language": "vi"
                }
                
                dresp = requests.get(details_url, params=details_params, timeout=10, headers=headers)
                ddata = dresp.json().get("result", {})
                
                if ddata:
                    photo_url = ""
                    if ddata.get("photos") and len(ddata["photos"]) > 0:
                        pr = ddata["photos"][0].get("photo_reference")
                        if pr:
                            photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={pr}&key={PLACES_API_KEY}"
                    
                    return {
                        "name": ddata.get("name", place_name),
                        "address": ddata.get("formatted_address", ""),
                        "rating": ddata.get("rating", 0),
                        "total_ratings": ddata.get("user_ratings_total", 0),
                        "photo_url": photo_url,
                        "lat": ddata.get("geometry", {}).get("location", {}).get("lat", 0),
                        "lng": ddata.get("geometry", {}).get("location", {}).get("lng", 0),
                        "types": ddata.get("types", []),
                        "price_level": ddata.get("price_level", 0)
                    }
        
        # Strategy 2: Find Place From Text (more forgiving, good for generic names)
        find_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        find_params = {
            "input": f"{q} {location}".strip(),
            "inputtype": "textquery",
            "fields": "place_id,formatted_address,name,geometry",
            "key": PLACES_API_KEY,
            "language": "vi"
        }
        
        fresp = requests.get(find_url, params=find_params, timeout=8, headers=headers)
        fdata = fresp.json()
        
        print(f"      → FindPlace → {len(fdata.get('candidates', []))} candidates")
        
        if fdata.get("candidates"):
            cand = fdata["candidates"][0]
            place_id = cand.get("place_id")
            
            # Get full details
            details_url = "https://maps.googleapis.com/maps/api/place/details/json"
            details_params = {
                "place_id": place_id,
                "fields": "name,formatted_address,rating,user_ratings_total,photos,geometry,types,price_level",
                "key": PLACES_API_KEY,
                "language": "vi"
            }
            
            dresp = requests.get(details_url, params=details_params, timeout=10, headers=headers)
            ddata = dresp.json().get("result", {})
            
            if ddata:
                photo_url = ""
                if ddata.get("photos") and len(ddata["photos"]) > 0:
                    pr = ddata["photos"][0].get("photo_reference")
                    if pr:
                        photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={pr}&key={PLACES_API_KEY}"
                
                return {
                    "name": ddata.get("name", place_name),
                    "address": ddata.get("formatted_address", ""),
                    "rating": ddata.get("rating", 0),
                    "total_ratings": ddata.get("user_ratings_total", 0),
                    "photo_url": photo_url,
                    "lat": ddata.get("geometry", {}).get("location", {}).get("lat", 0),
                    "lng": ddata.get("geometry", {}).get("location", {}).get("lng", 0),
                    "types": ddata.get("types", []),
                    "price_level": ddata.get("price_level", 0)
                }
        
        # Strategy 3: Geocoding (fallback for area names or when specific place not found)
        geo_url = "https://maps.googleapis.com/maps/api/geocode/json"
        geo_params = {
            "address": f"{q} {location}".strip(),
            "key": PLACES_API_KEY,
            "language": "vi"
        }
        
        gresp = requests.get(geo_url, params=geo_params, timeout=8, headers=headers)
        gdata = gresp.json()
        
        print(f"      → Geocode → {len(gdata.get('results', []))} results")
        
        if gdata.get("results"):
            res = gdata["results"][0]
            loc = res.get("geometry", {}).get("location", {})
            return {
                "name": place_name,
                "address": res.get("formatted_address", ""),
                "rating": 0,
                "total_ratings": 0,
                "photo_url": "",
                "lat": loc.get("lat", 0),
                "lng": loc.get("lng", 0),
                "types": res.get("types", []),
                "price_level": 0
            }
        
        # No results from any strategy
        return {"name": place_name, "address": "", "rating": 0, "total_ratings": 0, "photo_url": "", "lat": 0, "lng": 0, "types": [], "price_level": 0}
    
    except Exception as e:
        print(f"⚠️ Error fetching Places API for '{place_name}': {e}")
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

🎯 NHIỆM VỤ: Tạo một kế hoạch du lịch chi tiết, thực tế và hấp dẫn.

📋 THÔNG TIN CHUYẾN ĐI:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Địa điểm: {trip_request.destination}
• Thời gian: {trip_request.duration} ngày
• Ngày bắt đầu: {trip_request.start_date}
• Ngân sách: {budget_desc}
• Sở thích: {trip_request.preferences if trip_request.preferences else "Du lịch tổng hợp"}

🎨 YÊU CẦU QUAN TRỌNG:
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

📊 FORMAT JSON (CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC):
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

🔴 QUY TẮC VỀ TÊN ĐỊA ĐIỂM (BẮT BUỘC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ SAI: "Ăn trưa tại nhà hàng (VD: Quán Ngon)"
✅ ĐÚNG: "Quán Ngon"

❌ SAI: "Thưởng thức món ăn đường phố"  
✅ ĐÚNG: "Chợ Đêm Đà Lạt"

❌ SAI: "Nhận phòng khách sạn"
✅ ĐÚNG: "Dalat Palace Heritage Hotel"

❌ SAI: "Tham quan chùa địa phương"
✅ ĐÚNG: "Chùa Linh Phước"

❌ SAI: "Mua sắm quà lưu niệm"
✅ ĐÚNG: "Chợ Đà Lạt"

➡️ Trong trường "place": CHỈ GHI TÊN ĐỊA ĐIỂM, KHÔNG GHI MÔ TẢ HOẠT ĐỘNG
➡️ Mô tả hoạt động để trong trường "description"
➡️ TUYỆT ĐỐI KHÔNG dùng "VD:" hay "(VD: ...)" trong trường "place"

🚀 BẮT ĐẦU TẠO KẾ HOẠCH NGAY!
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
async def plan_trip(trip_request: TripRequest):
    """Main endpoint: Generate personalized travel itinerary"""
    try:
        print(f"\n🎯 Creating trip plan for: {trip_request.destination}")
        print(f"📅 Duration: {trip_request.duration} days | Budget: {trip_request.budget}")
        
        trip_prompt = create_trip_planning_prompt(trip_request)
        
        print("🤖 Calling Gemini AI...")
        response = await model.generate_content_async(trip_prompt)
        raw_text = response.text.strip()
        
        print("📊 Parsing JSON response...")
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        
        if not match:
            print("⚠️ JSON not found in response")
            return JSONResponse(
                status_code=500,
                content={"error": "AI không trả về định dạng JSON hợp lệ", "raw": raw_text[:500]}
            )
        
        json_str = match.group(1) or match.group(2)
        trip_plan = json.loads(json_str)
        
        print("📍 Enriching with Google Places API...")
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
        
        print(f"✅ Trip plan generated successfully with {total_activities} activities!")
        return JSONResponse(content=trip_plan)
    
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Lỗi parse JSON từ AI", "details": str(e)}
        )
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Lỗi máy chủ", "details": str(e)}
        )
