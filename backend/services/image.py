"""Image service using Unsplash API"""
import httpx
import requests
from core.config import UNSPLASH_ACCESS_KEY


def get_unsplash_image(destination: str) -> str:
    """Get a high-quality image from Unsplash for a destination"""
    try:
        query = destination
        vietnamese_cities = ["Hà Nội", "Hanoi", "Sài Gòn", "Saigon", "Hồ Chí Minh", "Ho Chi Minh", 
                             "Đà Nẵng", "Da Nang", "Huế", "Hue", "Nha Trang", "Vũng Tàu", "Vung Tau"]
        
        if any(city.lower() in destination.lower() for city in vietnamese_cities):
            query = f"{destination} Vietnam cityscape"
        else:
            query = f"{destination} travel landmark cityscape"
        
        url = "https://api.unsplash.com/search/photos"
        params = {
            "client_id": UNSPLASH_ACCESS_KEY,
            "query": query,
            "per_page": 1,
            "orientation": "landscape",
            "content_filter": "high"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("results") and len(data["results"]) > 0:
                image_url = data["results"][0]["urls"]["regular"]
                print(f"Unsplash: Found image for '{destination}'")
                return image_url
            else:
                print(f"Unsplash: No results for '{destination}'")
        else:
            print(f"Unsplash API Error {response.status_code}")
            
    except Exception as e:
        print(f"Unsplash Exception: {e}")
    
    # Fallback to Lorem Picsum
    seed = destination.replace(' ', '').replace(',', '').lower()
    fallback_url = f"https://picsum.photos/seed/{seed}/1200/800"
    print(f"Using fallback image for '{destination}'")
    return fallback_url


async def get_unsplash_image_async(destination: str) -> str:
    """Async version: Get a high-quality image from Unsplash"""
    try:
        query = destination
        vietnamese_cities = ["Hà Nội", "Hanoi", "Sài Gòn", "Saigon", "Hồ Chí Minh", "Ho Chi Minh", 
                             "Đà Nẵng", "Da Nang", "Huế", "Hue", "Nha Trang", "Vũng Tàu", "Vung Tau"]
        
        if any(city.lower() in destination.lower() for city in vietnamese_cities):
            query = f"{destination} Vietnam cityscape"
        else:
            query = f"{destination} travel landmark cityscape"
        
        url = "https://api.unsplash.com/search/photos"
        params = {
            "client_id": UNSPLASH_ACCESS_KEY,
            "query": query,
            "per_page": 1,
            "orientation": "landscape",
            "content_filter": "high"
        }
        
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("results") and len(data["results"]) > 0:
                    image_url = data["results"][0]["urls"]["regular"]
                    print(f"Unsplash (async): Found image for '{destination}'")
                    return image_url
                else:
                    print(f"Unsplash (async): No results for '{destination}'")
            else:
                print(f"Unsplash API Error {response.status_code}")
            
    except Exception as e:
        print(f"Unsplash Exception (async): {e}")
    
    # Fallback to Lorem Picsum
    seed = destination.replace(' ', '').replace(',', '').lower()
    fallback_url = f"https://picsum.photos/seed/{seed}/1200/800"
    print(f"Using fallback image for '{destination}'")
    return fallback_url
