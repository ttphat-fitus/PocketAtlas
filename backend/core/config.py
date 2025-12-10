"""Configuration management for API keys and settings"""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# Load API Keys from environment or JSON files
KEY_DIR = Path(__file__).parent.parent / "key"

# Try to load from environment first, then from JSON files (for local development)
def load_key(env_var: str, json_file: str = None, json_key: list = None):
    """Load API key from environment variable or JSON file"""
    value = os.getenv(env_var)
    if value:
        return value
    
    if json_file and json_key:
        try:
            with open(KEY_DIR / json_file) as f:
                data = json.load(f)
                result = data
                for key in json_key:
                    result = result[key]
                return result
        except (FileNotFoundError, KeyError):
            print(f"Warning: Could not load {env_var} from {json_file}")
            return None
    return None

GOOGLE_API_KEY = load_key("GOOGLE_API_KEY", "chatbot_key.json", ["GOOGLE_API_KEY"])
GOOGLE_MAPS_API_KEY = load_key("GOOGLE_MAPS_API_KEY", "maps_key.json", ["GOOGLE_MAPS_API_KEY"])
WEATHER_API_KEY = load_key("WEATHER_API_KEY", "weather_key.json", ["WeatherAPIKey"])
UNSPLASH_ACCESS_KEY = load_key("UNSPLASH_ACCESS_KEY", "unsplash_key.json", ["credentials", "accessKey"])

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
    'gemini-2.5-flash',
    generation_config=GENERATION_CONFIG,
    safety_settings=SAFETY_SETTINGS
)
