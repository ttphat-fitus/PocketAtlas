"""Podcast generation service using Google Cloud Text-to-Speech"""
from google.cloud import texttospeech
from google.cloud import storage
from core.database import db
from services.ai import model
import io
import json
import re
from datetime import datetime
from typing import Optional


class PodcastService:
    def __init__(self):
        """Initialize TTS client"""
        try:
            self.tts_client = texttospeech.TextToSpeechClient()
        except Exception as e:
            print(f"[WARN] Could not initialize TTS client: {e}")
            self.tts_client = None
        # Storage will be handled by Firebase Storage in future implementation
    
    async def generate_trip_podcast(self, trip_id: str, user_id: str, language: str = "vi") -> dict:
        """Generate audio podcast from trip data"""
        try:
            # Fetch trip data
            trip_ref = db.collection("trips").where("user_id", "==", user_id).where("id", "==", trip_id).limit(1)
            trips = list(trip_ref.stream())
            
            if not trips:
                raise ValueError("Trip not found")
            
            trip_data = trips[0].to_dict()
            
            # Generate podcast script using AI
            script = await self._generate_script(trip_data, language)
            
            # Convert to audio
            audio_content = self._text_to_speech(
                script["full_text"],
                language_code=f"{language}-VN",
                voice_name=f"{language}-VN-Wavenet-A"
            )
            
            # In future: Upload to Firebase Storage
            # For now, return script and audio metadata
            podcast_data = {
                "trip_id": trip_id,
                "user_id": user_id,
                "script": script,
                "audio_size": len(audio_content),
                "duration_estimate": len(script["full_text"]) // 150,  # Rough estimate: 150 chars per minute
                "language": language,
                "created_at": datetime.now().isoformat()
            }
            
            # Save metadata to Firestore
            db.collection("podcasts").document(trip_id).set(podcast_data)
            
            return {
                "success": True,
                "podcast": podcast_data,
                "message": "Podcast generated successfully"
            }
            
        except Exception as e:
            print(f"Error generating podcast: {e}")
            raise
    
    async def _generate_script(self, trip_data: dict, language: str) -> dict:
        """Generate podcast script using Gemini AI"""
        try:
            trip_plan = trip_data.get("trip_plan", {})
            
            prompt = f"""
Create an engaging podcast script for this travel itinerary in {language}:

Destination: {trip_data.get('destination')}
Duration: {trip_data.get('duration')} days
Trip Name: {trip_plan.get('trip_name', '')}
Overview: {trip_plan.get('overview', '')}

Days:
"""
            for day in trip_plan.get("days", []):
                prompt += f"\nDay {day['day']}: {day.get('title', '')}\n"
                for activity in day.get("activities", []):
                    prompt += f"  - {activity.get('time')}: {activity.get('place')} - {activity.get('description', '')[:100]}\n"
            
            prompt += f"""

Create a podcast script in {language} with:
1. Engaging introduction (30 seconds)
2. Day-by-day narration with highlights
3. Tips and recommendations
4. Closing summary

Format as JSON:
{{
  "title": "Podcast title",
  "introduction": "Introduction text (conversational style)",
  "days": [
    {{
      "day": 1,
      "narration": "Day narration text"
    }}
  ],
  "conclusion": "Conclusion text",
  "full_text": "Complete script for TTS"
}}

Keep narration conversational and engaging.
RETURN ONLY JSON.
"""
            
            response = await model.generate_content_async(prompt)
            raw_text = response.text.strip()
            
            match = re.search(r'```json\s*(\{{.*?\}})\s*```|(\{{.*?\}})', raw_text, re.DOTALL)
            if match:
                json_text = match.group(1) if match.group(1) else match.group(2)
                script = json.loads(json_text)
                return script
            else:
                raise ValueError("Could not extract JSON from AI response")
                
        except Exception as e:
            print(f"Error generating script: {e}")
            raise
    
    def _text_to_speech(self, text: str, language_code: str = "vi-VN", 
                        voice_name: str = "vi-VN-Wavenet-A") -> bytes:
        """Convert text to speech using Google TTS"""
        if self.tts_client is None:
            raise ValueError("TTS client not initialized - check credentials")
        
        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_name,
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=1.0,
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
