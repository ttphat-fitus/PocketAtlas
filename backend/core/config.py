"""Configuration management for API keys and settings"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv('.env.local')
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
GOOGLE_WEATHER_API_KEY = os.getenv("GOOGLE_WEATHER_API_KEY") or GOOGLE_MAPS_API_KEY
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")

# Configure Gemini AI
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    print("Warning: GOOGLE_API_KEY not configured")

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
    'gemini-2.5-pro',
    generation_config=GENERATION_CONFIG,
    safety_settings=SAFETY_SETTINGS
)
