"""AI service for trip planning using Gemini"""
from core.config import model
from models.trip import TripRequest
import re
import json


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
    
    prompt = f"""
Bạn là một chuyên gia tư vấn du lịch chuyên nghiệp với 15 năm kinh nghiệm trong việc lập kế hoạch du lịch tại Việt Nam và thế giới.

NHIỆM VỤ: Tạo một kế hoạch du lịch chi tiết, thực tế và hấp dẫn
THÔNG TIN CHUYẾN ĐI:
• Địa điểm: {trip_request.destination}
• Thời gian: {trip_request.duration} ngày
• Ngày bắt đầu: {trip_request.start_date}
• Ngân sách: {budget_desc}
• Mức độ hoạt động: {activity_desc}
• Nhóm du lịch: {group_desc}
• Quy mô nhóm: {trip_request.group_size if trip_request.group_size else "Không chỉ định"}
• Cách du lịch/Phương tiện: {trip_request.travel_mode if trip_request.travel_mode else "Không chỉ định"}
• Danh mục ưu tiên: {categories_text}
• Thời gian hoạt động: {str(trip_request.active_time_start).zfill(2)}:00 - {str(trip_request.active_time_end).zfill(2)}:00
• Sở thích khác: {trip_request.preferences if trip_request.preferences else "Không có yêu cầu đặc biệt"}

YÊU CẦU QUAN TRỌNG:
1. **Địa điểm phải CỤ THỂ, CHÍNH XÁC và TÌM ĐƯỢC TRÊN GOOGLE MAPS**: 
   - Sử dụng TÊN CHÍNH XÁC của địa danh, nhà hàng, quán ăn, khách sạn
   - KHÔNG thêm "VD:", "(VD: ...)", hoặc ví dụ trong ngoặc đơn
   - KHÔNG dùng cụm từ chung chung như "Nhận phòng", "Mua quà", "Trả phòng"
   - Nếu là nhà hàng/quán ăn: ghi TÊN CỤ THỂ
   - Nếu là khách sạn: ghi TÊN THẬT

2. **Thời gian hợp lý**: 
   - Bắt đầu từ 7:00-8:00, kết thúc 20:00-21:00
   - Mỗi hoạt động từ 1.5-3 giờ
  - LUÔN chừa thời gian di chuyển/nghỉ giữa 2 hoạt động liên tiếp (tối thiểu 15-45 phút)
  - KHÔNG được để thời gian kết thúc của hoạt động A trùng đúng thời gian bắt đầu của hoạt động B

3. **Chi phí THỰC TẾ**:
   - Ngân sách LOW: 50.000-150.000 đ/hoạt động
   - Ngân sách MEDIUM: 150.000-500.000 đ/hoạt động  
   - Ngân sách HIGH: 500.000-2.000.000 đ/hoạt động
   - QUAN TRỌNG: Mọi hoạt động ĐỀU PHẢI có chi phí cụ thể

4. **CHI PHÍ FORMAT**: Chỉ ghi số tiền và đơn vị đ, KHÔNG thêm mô tả trong ngoặc đơn

FORMAT JSON (CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC):
{{
  "trip_name": "Tên chuyến đi hấp dẫn",
  "overview": "Tổng quan 2-3 câu về điểm nổi bật của chuyến đi",
  "total_estimated_cost": "5.000.000 - 7.000.000 đ",
  "days": [
    {{
      "day": 1,
      "title": "Tiêu đề cho ngày 1",
      "activities": [
        {{
          "time": "08:00 - 10:00",
          "place": "Tên địa điểm cụ thể",
          "description": "Mô tả hoạt động chi tiết",
          "estimated_cost": "100.000 - 200.000 đ",
          "tips": "Lời khuyên cụ thể"
        }}
      ]
    }}
  ],
  "packing_list": [
    "Đồ dùng 1",
    "Đồ dùng 2",
    "Đồ dùng 3"
  ],
  "travel_tips": [
    "Mẹo du lịch 1",
    "Mẹo du lịch 2",
    "Mẹo du lịch 3"
  ]
}}

QUAN TRỌNG: 
- packing_list: Liệt kê 5-8 đồ dùng thiết yếu phù hợp với chuyến đi (quần áo, giày dép, thuốc men, đồ cá nhân...)
- travel_tips: Đưa ra 5-7 lời khuyên hữu ích về thời tiết, giao thông, an toàn, văn hóa địa phương
"""
    return prompt


async def generate_trip_plan(trip_request: TripRequest) -> dict:
    """Generate trip plan using Gemini AI"""
    try:
        prompt = create_trip_planning_prompt(trip_request)
        response = await model.generate_content_async(prompt)
        raw_text = response.text.strip()
        
        # Extract JSON from response
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        if match:
            json_text = match.group(1) if match.group(1) else match.group(2)
            trip_plan = json.loads(json_text)
            return trip_plan
        else:
            raise ValueError("Could not extract JSON from AI response")
            
    except Exception as e:
        print(f"Error generating trip plan: {e}")
        raise


async def generate_blog_from_trip(trip_data: dict) -> dict:
    """Generate blog content from trip data using AI"""
    try:
        trip_plan = trip_data.get("trip_plan", {})
        
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
            prompt += f"\nNgày {day['day']}: {day.get('title', '')}\n"
            for activity in day.get("activities", []):
                prompt += f"  - {activity.get('time')}: {activity.get('place')}\n"

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
        
        response = await model.generate_content_async(prompt)
        raw_text = response.text.strip()
        
        match = re.search(r'```json\s*(\{.*?\})\s*```|(\{.*?\})', raw_text, re.DOTALL)
        if match:
            json_text = match.group(1) if match.group(1) else match.group(2)
            blog_data = json.loads(json_text)
            return blog_data
        else:
            raise ValueError("Could not extract JSON from AI response")
            
    except Exception as e:
        print(f"Error generating blog: {e}")
        raise
