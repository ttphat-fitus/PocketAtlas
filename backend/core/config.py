"""Configuration management for API keys and settings"""
import json
import google.generativeai as genai
from pathlib import Path

# Load API Keys
KEY_DIR = Path(__file__).parent.parent / "key"

GOOGLE_API_KEY = json.load(open(KEY_DIR / "chatbot_key.json"))["GOOGLE_API_KEY"]
GOOGLE_MAPS_API_KEY = json.load(open(KEY_DIR / "maps_key.json"))["GOOGLE_MAPS_API_KEY"]
WEATHER_API_KEY = json.load(open(KEY_DIR / "weather_key.json"))["WeatherAPIKey"]
UNSPLASH_ACCESS_KEY = json.load(open(KEY_DIR / "unsplash_key.json"))["credentials"]["accessKey"]

# Configure Gemini AI
genai.configure(api_key=GOOGLE_API_KEY)

# Gemini model configuration
GENERATION_CONFIG = {
    "temperature": 0.8,
    "top_p": 0.95,
    "top_k": 40,
}

SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Initialize Gemini model
model = genai.GenerativeModel(
    'gemini-2.5-flash',
    generation_config=GENERATION_CONFIG,
    safety_settings=SAFETY_SETTINGS
)
