"""Podcast generation service using Google Cloud Text-to-Speech"""
from google.cloud import texttospeech
from google.cloud import storage
from core.database import db
from services.ai import model
import io
import json
import re
import os
from datetime import datetime
from typing import Optional
from google.oauth2 import service_account


class PodcastService:
    def __init__(self):
        """Initialize TTS client with speech credentials"""
        try:
            # Load speech credentials
            speech_key_path = os.path.join(os.path.dirname(__file__), "..", "key", "speech_key.json")
            credentials = service_account.Credentials.from_service_account_file(speech_key_path)
            self.tts_client = texttospeech.TextToSpeechClient(credentials=credentials)
            print("[OK] TTS client initialized successfully")
        except Exception as e:
            print(f"[WARN] Could not initialize TTS client: {e}")
            self.tts_client = None
        # Storage will be handled by Firebase Storage in future implementation
    
    async def generate_trip_podcast(self, trip_id: str, user_id: str, language: str = "vi") -> dict:
        """Generate audio podcast from trip data"""
        try:
            # Fetch trip data using document ID
            trip_doc = db.collection("trips").document(trip_id).get()
            
            if not trip_doc.exists:
                raise ValueError("Trip not found")
            
            trip_data = trip_doc.to_dict()
            
            # Generate podcast script using AI
            script = await self._generate_script(trip_data, language)
            
            # Convert to audio (truncate if needed to stay within 5000 byte limit)
            full_text = script["full_text"]
            
            # Check byte length and truncate if necessary
            max_bytes = 4500  # Leave some margin
            if len(full_text.encode('utf-8')) > max_bytes:
                # Truncate to fit within limit
                truncated = full_text.encode('utf-8')[:max_bytes].decode('utf-8', errors='ignore')
                # Find last complete sentence
                last_period = truncated.rfind('.')
                if last_period > 0:
                    full_text = truncated[:last_period + 1]
                else:
                    full_text = truncated
                print(f"[WARN] Podcast script truncated from {len(script['full_text'])} to {len(full_text)} characters")
            
            audio_content = self._text_to_speech(
                full_text,
                language_code=f"{language}-VN",
                voice_name=f"{language}-VN-Neural2-A"
            )
            
            # Convert audio to base64 data URL for immediate playback
            import base64
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            audio_data_url = f"data:audio/mpeg;base64,{audio_base64}"
            
            # Save metadata to Firestore
            podcast_data = {
                "trip_id": trip_id,
                "user_id": user_id,
                "script": script,
                "audio_size": len(audio_content),
                "duration_estimate": len(full_text) // 150,  # Rough estimate: 150 chars per minute
                "language": language,
                "created_at": datetime.now().isoformat()
            }
            
            db.collection("podcasts").document(trip_id).set(podcast_data)
            
            return {
                "success": True,
                "podcast_url": audio_data_url,
                "podcast": podcast_data,
                "message": "Podcast generated successfully"
            }
            
        except Exception as e:
            print(f"Error generating podcast: {e}")
            raise
    
    async def _generate_script(self, trip_data: dict, language: str) -> dict:
        """Generate podcast script using Gemini AI with weather info"""
        try:
            trip_plan = trip_data.get("trip_plan", {})
            weather_data = trip_data.get("weather", {})
            
            # Build weather info for prompt
            weather_info = ""
            if weather_data and weather_data.get("forecasts"):
                forecasts = weather_data.get("forecasts", [])[:3]
                weather_info = f"\nThông tin thời tiết:\n"
                for fc in forecasts:
                    temp_max = fc.get('temp_max', '')
                    temp_min = fc.get('temp_min', '')
                    condition = fc.get('condition', '')
                    rain_chance = fc.get('rain_chance', 0)
                    weather_info += f"- {fc.get('date')} ({fc.get('day_name', '')}): {temp_min}-{temp_max}°C, {condition}, Khả năng mưa: {rain_chance}%\n"
            
            prompt = f"""
Bạn là hướng dẫn viên du lịch chuyên nghiệp với giọng nói tự nhiên, thân thiện. 
Hãy tạo nội dung podcast giới thiệu chuyến đi này bằng tiếng Việt.

Thông tin chuyến đi:
- Điểm đến: {trip_data.get('destination')}
- Thời gian: {trip_data.get('duration')} ngày
- Tên chuyến đi: {trip_plan.get('trip_name', '')}
- Tổng quan: {trip_plan.get('overview', '')}
{weather_info}

Lịch trình chi tiết:
"""
            for day in trip_plan.get("days", []):
                prompt += f"\nNgày {day['day']}: {day.get('title', '')}\n"
                for activity in day.get("activities", []):
                    prompt += f"  - {activity.get('time')}: {activity.get('place')} - {activity.get('description', '')[:100]}\n"
            
            prompt += """

Hãy tạo nội dung podcast với:
1. Lời chào và giới thiệu địa điểm (30 giây) - giọng điệu vui vẻ, thu hút
2. Giới thiệu sơ lược về địa điểm, điểm nổi bật
3. Thông tin thời tiết (nếu có) - nhắc nhở người nghe chuẩn bị phù hợp
4. Điểm nhấn từng ngày trong lịch trình
5. Lời kết động viên

Format JSON:
{
  "title": "Tiêu đề podcast",
  "introduction": "Lời chào mở đầu tự nhiên, thân thiện",
  "location_overview": "Giới thiệu về địa điểm",
  "weather_note": "Thông tin thời tiết (nếu có)",
  "daily_highlights": "Điểm nhấn các ngày",
  "conclusion": "Lời kết động viên",
  "full_text": "Toàn bộ nội dung đầy đủ để đọc (kết hợp các phần trên)"
}

Giọng điệu: Tự nhiên như đang trò chuyện, nhiệt tình nhưng không quá phô trương.
CHỈ TRẢ VỀ JSON, KHÔNG TEXT KHÁC.
"""
            
            response = await model.generate_content_async(prompt)
            raw_text = response.text.strip()
            
            # Try multiple patterns to extract JSON
            patterns = [
                r'```json\s*(\{.*?\})\s*```',  # ```json {...} ```
                r'```\s*(\{.*?\})\s*```',      # ``` {...} ```
                r'(\{.*?\})',                   # {...}
            ]
            
            for pattern in patterns:
                match = re.search(pattern, raw_text, re.DOTALL)
                if match:
                    try:
                        json_text = match.group(1)
                        script = json.loads(json_text)
                        return script
                    except json.JSONDecodeError:
                        continue
            
            # If no pattern works, print raw response for debugging
            print(f"[ERROR] Could not parse AI response. Raw text (first 500 chars):\n{raw_text[:500]}")
            raise ValueError("Could not extract valid JSON from AI response")
                
        except Exception as e:
            print(f"Error generating script: {e}")
            raise
    
    def _text_to_speech(self, text: str, language_code: str = "vi-VN", 
                        voice_name: str = "vi-VN-Neural2-A") -> bytes:
        """Convert text to speech using Google TTS - Vietnamese female voice"""
        if self.tts_client is None:
            raise ValueError("TTS client not initialized - check credentials")
        
        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Use Vietnamese Neural2 voice for natural, professional female tour guide voice
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_name,  # vi-VN-Neural2-A is natural female voice
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )
            
            # Optimized audio config for natural tour guide narration
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=0.95,  # Slightly slower for clarity
                pitch=0.0,
                volume_gain_db=0.0
            )
            
            response = self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            return response.audio_content
            
        except Exception as e:
            print(f"Error in text-to-speech: {e}")
            raise
    
    def get_podcast(self, trip_id: str) -> Optional[dict]:
        """Get podcast metadata for a trip"""
        try:
            podcast_doc = db.collection("podcasts").document(trip_id).get()
            if podcast_doc.exists:
                return podcast_doc.to_dict()
            return None
        except Exception as e:
            print(f"Error fetching podcast: {e}")
            return None


# Initialize service
podcast_service = PodcastService()
