"""Weather service for getting weather forecasts."""
from __future__ import annotations
from datetime import date, datetime
from typing import Any, Optional
import httpx
import requests
from core.config import GOOGLE_WEATHER_API_KEY, WEATHER_API_KEY


GOOGLE_WEATHER_DAYS_LOOKUP_URL = "https://weather.googleapis.com/v1/forecast/days:lookup"
WEATHERAPI_FORECAST_URL = "https://api.weatherapi.com/v1/forecast.json"


def _redact_secrets(text: str) -> str:
    if not text:
        return ""
    import re

    redacted = text
    patterns = [
        r"(?i)([?&]key=)[^&\s]+",
        r"(?i)([?&]api_key=)[^&\s]+",
        r"(?i)([?&]apikey=)[^&\s]+",
        r"(?i)([?&]token=)[^&\s]+",
    ]
    for p in patterns:
        redacted = re.sub(p, r"\1REDACTED", redacted)
    return redacted


def _safe_url_for_logs(url: Any) -> str:
    try:
        url_str = str(url)
    except Exception:
        return ""
    return _redact_secrets(url_str)


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _qpf_mm(precip: Optional[dict]) -> float:
    if not isinstance(precip, dict):
        return 0.0
    qpf = precip.get("qpf")
    if not isinstance(qpf, dict):
        return 0.0
    quantity = _as_float(qpf.get("quantity"), 0.0)
    unit = str(qpf.get("unit") or "").upper()
    if unit == "INCHES":
        return quantity * 25.4
    return quantity


def _precip_percent(precip: Optional[dict]) -> int:
    if not isinstance(precip, dict):
        return 0
    prob = precip.get("probability")
    if not isinstance(prob, dict):
        return 0
    try:
        return int(prob.get("percent") or 0)
    except Exception:
        return 0


def _condition_text(weather_condition: Optional[dict]) -> str:
    if not isinstance(weather_condition, dict):
        return "Clear"
    desc = weather_condition.get("description")
    if isinstance(desc, dict):
        text = str(desc.get("text") or "").strip()
        if text:
            return text
    cond_type = str(weather_condition.get("type") or "").strip()
    return cond_type or "Clear"


def _condition_type(weather_condition: Optional[dict]) -> str:
    if not isinstance(weather_condition, dict):
        return ""
    return str(weather_condition.get("type") or "").upper()


def _display_date_str(display_date: Optional[dict]) -> str:
    if not isinstance(display_date, dict):
        return ""
    try:
        y = int(display_date.get("year") or 0)
        m = int(display_date.get("month") or 0)
        d = int(display_date.get("day") or 0)
        if y and m and d:
            return date(y, m, d).strftime("%Y-%m-%d")
    except Exception:
        return ""
    return ""


def _flags_from_condition(cond_type: str, rain_chance: int, precip_mm: float) -> tuple[bool, bool]:
    t = (cond_type or "").upper()
    rainy = (
        rain_chance >= 50
        or precip_mm >= 1.0
        or "RAIN" in t
        or "SHOWERS" in t
        or "THUNDER" in t
        or "STORM" in t
        or "HAIL" in t
        or "SLEET" in t
        or "FREEZING_RAIN" in t
    )
    sunny = t in {"CLEAR", "MOSTLY_CLEAR"}
    return rainy, sunny


def _suggestion(is_rainy: bool, is_sunny: bool) -> str:
    if is_rainy:
        return "Indoor activities recommended"
    if is_sunny:
        return "Great for outdoor activities"
    return "Mixed activities suitable"


def _google_days_lookup(lat: float, lng: float, days: int, language_code: str) -> dict:
    if not GOOGLE_WEATHER_API_KEY:
        raise RuntimeError("Missing GOOGLE_WEATHER_API_KEY")

    safe_days = max(1, min(int(days or 10), 10))
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "days": safe_days,
        "unitsSystem": "METRIC",
        "languageCode": language_code,
        "pageSize": safe_days,
        "key": GOOGLE_WEATHER_API_KEY,
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "PocketAtlas/1.0",
    }

    try:
        resp = requests.get(GOOGLE_WEATHER_DAYS_LOOKUP_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        message = ""
        try:
            payload = e.response.json() if getattr(e, "response", None) is not None else {}
            if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                message = str(payload["error"].get("message") or "").strip()
        except Exception:
            message = ""
        if not message:
            try:
                message = (e.response.text or "").strip()[:400] if getattr(e, "response", None) is not None else ""
            except Exception:
                message = ""
        raise RuntimeError(f"Google Weather HTTP {status}: {message}") from None


async def _google_days_lookup_async(lat: float, lng: float, days: int, language_code: str) -> dict:
    if not GOOGLE_WEATHER_API_KEY:
        raise RuntimeError("Missing GOOGLE_WEATHER_API_KEY")

    safe_days = max(1, min(int(days or 10), 10))
    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "days": safe_days,
        "unitsSystem": "METRIC",
        "languageCode": language_code,
        "pageSize": safe_days,
        "key": GOOGLE_WEATHER_API_KEY,
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "PocketAtlas/1.0",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(GOOGLE_WEATHER_DAYS_LOOKUP_URL, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            status = e.response.status_code if e.response is not None else None
            message = ""
            try:
                payload = e.response.json() if e.response is not None else {}
                if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                    message = str(payload["error"].get("message") or "").strip()
            except Exception:
                message = ""
            if not message:
                try:
                    message = (e.response.text or "").strip()[:400] if e.response is not None else ""
                except Exception:
                    message = ""
            raise RuntimeError(f"Google Weather HTTP {status}: {message}") from None


def _weatherapi_forecast(lat: float, lng: float, days: int, language_code: str) -> dict:
    if not WEATHER_API_KEY:
        raise RuntimeError("Missing WEATHER_API_KEY")

    safe_days = max(1, min(int(days or 10), 10))
    params = {
        "key": WEATHER_API_KEY,
        "q": f"{lat},{lng}",
        "days": safe_days,
        "aqi": "no",
        "alerts": "no",
        "lang": language_code,
    }
    resp = requests.get(WEATHERAPI_FORECAST_URL, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


async def _weatherapi_forecast_async(lat: float, lng: float, days: int, language_code: str) -> dict:
    if not WEATHER_API_KEY:
        raise RuntimeError("Missing WEATHER_API_KEY")

    safe_days = max(1, min(int(days or 10), 10))
    params = {
        "key": WEATHER_API_KEY,
        "q": f"{lat},{lng}",
        "days": safe_days,
        "aqi": "no",
        "alerts": "no",
        "lang": language_code,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(WEATHERAPI_FORECAST_URL, params=params)
        resp.raise_for_status()
        return resp.json()


def _parse_weatherapi_daily(data: dict) -> list[dict]:
    out: list[dict] = []
    forecast = (data or {}).get("forecast") if isinstance(data, dict) else None
    days = (forecast or {}).get("forecastday") if isinstance(forecast, dict) else None
    if not isinstance(days, list):
        return out

    for d in days:
        if not isinstance(d, dict):
            continue
        date_str = str(d.get("date") or "").strip()
        if not date_str:
            continue

        day = d.get("day") if isinstance(d.get("day"), dict) else {}
        cond = day.get("condition") if isinstance(day.get("condition"), dict) else {}
        cond_text = str(cond.get("text") or "Clear").strip() or "Clear"
        cond_type = cond_text.upper().replace(" ", "_")

        rain_chance = 0
        try:
            rain_chance = int(day.get("daily_chance_of_rain") or 0)
        except Exception:
            rain_chance = 0

        precip_mm = _as_float(day.get("totalprecip_mm"), 0.0)
        humidity = 0
        try:
            humidity = int(day.get("avghumidity") or 0)
        except Exception:
            humidity = 0

        max_temp = _as_float(day.get("maxtemp_c"), 0.0)
        min_temp = _as_float(day.get("mintemp_c"), 0.0)

        is_rainy, is_sunny = _flags_from_condition(cond_type, rain_chance, precip_mm)

        out.append({
            "date": date_str,
            "day_name": datetime.strptime(date_str, "%Y-%m-%d").strftime("%A"),
            "temp_max": round(max_temp),
            "temp_min": round(min_temp),
            "precipitation": round(precip_mm, 1),
            "condition": cond_text,
            "humidity": humidity,
            "rain_chance": rain_chance,
            "is_rainy": is_rainy,
            "is_sunny": is_sunny,
            "suggestion": _suggestion(is_rainy, is_sunny),
        })

    return out


def get_weather_forecast(lat: float, lng: float, days: int = 10) -> dict:
    """Get weather forecast using Google Maps Platform Weather API (daily)."""
    try:
        print(f"[INFO] Fetching weather for coordinates: {lat}, {lng}")
        try:
            data = _google_days_lookup(float(lat), float(lng), days=days, language_code="vi")
            forecast_days = data.get("forecastDays", []) if isinstance(data, dict) else []
        except Exception as google_err:
            # Avoid leaking secrets in logs.
            print(f"Weather API error (google): {_redact_secrets(str(google_err))}")
            # Fallback to WeatherAPI.com if configured.
            data = _weatherapi_forecast(float(lat), float(lng), days=days, language_code="vi")
            forecasts = _parse_weatherapi_daily(data)
            print(f"      Weather forecast: {len(forecasts)} days (fallback provider)")
            return {"forecasts": forecasts, "provider": "weatherapi"}

        # Google Weather parse

        forecasts = []
        for day_data in forecast_days:
            if not isinstance(day_data, dict):
                continue
            date_str = _display_date_str(day_data.get("displayDate"))
            if not date_str:
                continue

            daytime = day_data.get("daytimeForecast") if isinstance(day_data.get("daytimeForecast"), dict) else {}
            nighttime = day_data.get("nighttimeForecast") if isinstance(day_data.get("nighttimeForecast"), dict) else {}

            condition_dict = daytime.get("weatherCondition") if isinstance(daytime.get("weatherCondition"), dict) else {}
            cond_text = _condition_text(condition_dict)
            cond_type = _condition_type(condition_dict)

            rain_chance = max(
                _precip_percent(daytime.get("precipitation")),
                _precip_percent(nighttime.get("precipitation")),
            )
            precip_mm = max(
                _qpf_mm(daytime.get("precipitation")),
                _qpf_mm(nighttime.get("precipitation")),
            )
            humidity = int(daytime.get("relativeHumidity") or nighttime.get("relativeHumidity") or 0)

            max_temp = _as_float((day_data.get("maxTemperature") or {}).get("degrees"), 0.0)
            min_temp = _as_float((day_data.get("minTemperature") or {}).get("degrees"), 0.0)

            is_rainy, is_sunny = _flags_from_condition(cond_type, rain_chance, precip_mm)

            forecasts.append({
                "date": date_str,
                "day_name": datetime.strptime(date_str, "%Y-%m-%d").strftime("%A"),
                "temp_max": round(max_temp),
                "temp_min": round(min_temp),
                "precipitation": round(precip_mm, 1),
                "condition": cond_text,
                "humidity": humidity,
                "rain_chance": rain_chance,
                "is_rainy": is_rainy,
                "is_sunny": is_sunny,
                "suggestion": _suggestion(is_rainy, is_sunny),
            })

        print(f"      Weather forecast: {len(forecasts)} days with detailed conditions")
        return {"forecasts": forecasts, "provider": "google"}
    except Exception as e:
        print(f"Weather API error: {_redact_secrets(str(e))}")
        return {"forecasts": []}


async def get_weather_forecast_async(lat: float, lng: float, days: int = 10) -> dict:
    try:
        print(f"[INFO] Fetching weather for coordinates: {lat}, {lng}")
        try:
            data = await _google_days_lookup_async(float(lat), float(lng), days=days, language_code="vi")
            forecast_days = data.get("forecastDays", []) if isinstance(data, dict) else []
        except Exception as google_err:
            print(f"Google Weather API didn't support this location!")
            data = await _weatherapi_forecast_async(float(lat), float(lng), days=days, language_code="vi")
            forecasts = _parse_weatherapi_daily(data)
            return {"forecasts": forecasts, "provider": "weatherapi"}

        forecasts = []
        for day_data in forecast_days:
            if not isinstance(day_data, dict):
                continue
            date_str = _display_date_str(day_data.get("displayDate"))
            if not date_str:
                continue

            daytime = day_data.get("daytimeForecast") if isinstance(day_data.get("daytimeForecast"), dict) else {}
            nighttime = day_data.get("nighttimeForecast") if isinstance(day_data.get("nighttimeForecast"), dict) else {}

            condition_dict = daytime.get("weatherCondition") if isinstance(daytime.get("weatherCondition"), dict) else {}
            cond_text = _condition_text(condition_dict)
            cond_type = _condition_type(condition_dict)

            rain_chance = max(
                _precip_percent(daytime.get("precipitation")),
                _precip_percent(nighttime.get("precipitation")),
            )
            precip_mm = max(
                _qpf_mm(daytime.get("precipitation")),
                _qpf_mm(nighttime.get("precipitation")),
            )
            humidity = int(daytime.get("relativeHumidity") or nighttime.get("relativeHumidity") or 0)

            max_temp = _as_float((day_data.get("maxTemperature") or {}).get("degrees"), 0.0)
            min_temp = _as_float((day_data.get("minTemperature") or {}).get("degrees"), 0.0)

            is_rainy, is_sunny = _flags_from_condition(cond_type, rain_chance, precip_mm)

            forecasts.append({
                "date": date_str,
                "day_name": datetime.strptime(date_str, "%Y-%m-%d").strftime("%A"),
                "temp_max": round(max_temp),
                "temp_min": round(min_temp),
                "precipitation": round(precip_mm, 1),
                "condition": cond_text,
                "humidity": humidity,
                "rain_chance": rain_chance,
                "is_rainy": is_rainy,
                "is_sunny": is_sunny,
                "suggestion": _suggestion(is_rainy, is_sunny),
            })

        return {"forecasts": forecasts, "provider": "google"}
    except Exception as e:
        print(f"Weather API error (async): {_redact_secrets(str(e))}")
        return {"forecasts": []}
