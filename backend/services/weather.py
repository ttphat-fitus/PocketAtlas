"""Weather service for getting weather forecasts"""
import httpx
import requests
from datetime import datetime
from core.config import WEATHER_API_KEY


def get_weather_forecast(lat: float, lng: float, days: int = 10) -> dict:
    """Get weather forecast using WeatherAPI for detailed conditions"""
    try:
        # WeatherAPI endpoint - supports up to 7 days for trip planning
        url = "http://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHER_API_KEY,
            "q": f"{lat},{lng}",
            "days": min(days, 7),
            "aqi": "no",
            "alerts": "no"
        }
        
        print(f"[INFO] Fetching weather for coordinates: {lat}, {lng}")
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        
        forecast_days = data.get("forecast", {}).get("forecastday", [])
        
        forecasts = []
        for day_data in forecast_days:
            day_info = day_data.get("day", {})
            date_str = day_data.get("date", "")
            
            condition = day_info.get("condition", {}).get("text", "Clear")
            
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
        
        print(f"      Weather forecast: {len(forecasts)} days with detailed conditions")
        
        return {"forecasts": forecasts}
    except Exception as e:
        print(f"Weather API error: {e}")
        return {"forecasts": []}


async def get_weather_forecast_async(lat: float, lng: float, days: int = 10) -> dict:
    """Async version: Get weather forecast using WeatherAPI for detailed conditions"""
    try:
        url = "http://api.weatherapi.com/v1/forecast.json"
        params = {
            "key": WEATHER_API_KEY,
            "q": f"{lat},{lng}",
            "days": min(days, 7),
            "aqi": "no",
            "alerts": "no"
        }
        
        print(f"[INFO] Fetching weather for coordinates: {lat}, {lng}")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
        
        forecast_days = data.get("forecast", {}).get("forecastday", [])
        
        forecasts = []
        for day_data in forecast_days:
            day_info = day_data.get("day", {})
            date_str = day_data.get("date", "")
            
            condition = day_info.get("condition", {}).get("text", "Clear")
            
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
        return {"forecasts": forecasts}
    except Exception as e:
        print(f"Weather API error (async): {e}")
        return {"forecasts": []}
