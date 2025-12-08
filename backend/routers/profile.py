"""Profile and gamification router"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from datetime import datetime

from firebase import get_current_user
from core.database import db, firestore
from services.gamification import (calculate_user_stats, get_user_badges, 
                                  calculate_user_level, calculate_level_progress)

router = APIRouter()


@router.get("/api/user/profile")
async def get_user_profile(user = Depends(get_current_user)):
    """Get user profile information"""
    try:
        user_doc = db.collection("users").document(user['uid']).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        # Get trip count
        trips_ref = db.collection("trips").where("user_id", "==", user['uid'])
        total_trips = len(list(trips_ref.stream()))
        
        #Get public trips count
        public_trips_ref = db.collection("trips").where("user_id", "==", user['uid']).where("is_public", "==", True)
        public_trips_count = len(list(public_trips_ref.stream()))
        
        # Get liked trips count
        liked_ref = db.collection("trip_likes").where("user_id", "==", user['uid'])
        liked_count = len(list(liked_ref.stream()))
        
        profile = {
            "uid": user['uid'],
            "email": user_data.get("email", user.get("email")),
            "username": user_data.get("username", ""),
            "photo_url": user_data.get("photo_url", ""),
            "bio": user_data.get("bio", ""),
            "location": user_data.get("location", ""),
            "joined_date": user_data.get("created_at", ""),
            "total_trips": total_trips,
            "public_trips": public_trips_count,
            "liked_trips": liked_count
        }
        
        return JSONResponse(content={"success": True, "profile": profile})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/api/user/profile/complete")
async def get_complete_profile(user = Depends(get_current_user)):
    """Get complete user profile with all statistics"""
    try:
        user_id = user['uid']
        
        # Get basic profile
        user_doc = db.collection("users").document(user_id).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        # Calculate statistics
        stats = calculate_user_stats(user_id)
        badges = get_user_badges(user_id)
        earned_badges = [b for b in badges if b.get("earned")]
        level_info = calculate_user_level(stats)
        progress_to_next = calculate_level_progress(stats)
        
        # Get recent trips
        trips_ref = db.collection("trips").where("user_id", "==", user_id)
        all_trips = list(trips_ref.stream())
        # Sort in Python and take first 5
        all_trips.sort(key=lambda x: x.to_dict().get("created_at", ""), reverse=True)
        recent_trips = []
        for trip in all_trips[:5]:
            trip_data = trip.to_dict()
            recent_trips.append({
                "id": trip.id,
                "destination": trip_data.get("destination"),
                "duration": trip_data.get("duration"),
                "cover_image": trip_data.get("cover_image"),
                "is_public": trip_data.get("is_public", False),
                "created_at": trip_data.get("created_at")
            })
        
        # Get liked trips count
        liked_trips_ref = db.collection("trip_likes").where("user_id", "==", user_id)
        liked_count = len(list(liked_trips_ref.stream()))
        
        return JSONResponse(content={
            "success": True,
            "profile": {
                "uid": user_id,
                "email": user_data.get("email", user.get("email")),
                "username": user_data.get("username", ""),
                "photo_url": user_data.get("photo_url", ""),
                "bio": user_data.get("bio", ""),
                "location": user_data.get("location", ""),
                "joined_date": user_data.get("created_at", ""),
            },
            "statistics": {
                "total_trips": stats["trips_count"],
                "public_trips": stats["public_trips"],
                "total_views": stats["total_views"],
                "total_likes": stats["total_likes"],
                "blogs_count": stats["blogs_count"],
                "liked_trips": liked_count,
                "total_stars": stats["total_stars"]
            },
            "gamification": {
                "level": level_info,
                "next_level_progress": progress_to_next,
                "badges": earned_badges,
                "badges_count": len(earned_badges),
                "total_badges": len(badges)
            },
            "recent_trips": recent_trips
        })
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.put("/api/user/profile")
async def update_user_profile(request: Request, user = Depends(get_current_user)):
    """Update user profile information"""
    try:
        data = await request.json()
        
        user_ref = db.collection("users").document(user['uid'])
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            user_ref.set({
                "email": user.get("email"),
                "created_at": datetime.now().isoformat()
            })
        
        update_data = {}
        
        # Handle username - can come from displayName or username field
        if "username" in data and data["username"]:
            update_data["username"] = data["username"]
        elif "displayName" in data and data["displayName"]:
            update_data["username"] = data["displayName"]
        
        # Handle other fields
        if "bio" in data:
            update_data["bio"] = data["bio"]
        if "location" in data:
            update_data["location"] = data["location"]
        
        # Handle photo_url - can come from photo_url or photoURL field
        if "photo_url" in data and data["photo_url"]:
            update_data["photo_url"] = data["photo_url"]
        elif "photoURL" in data and data["photoURL"]:
            update_data["photo_url"] = data["photoURL"]
        
        if update_data:
            update_data["updated_at"] = datetime.now().isoformat()
            user_ref.update(update_data)
        
        # Get updated profile to return
        updated_doc = user_ref.get()
        updated_data = updated_doc.to_dict() if updated_doc.exists else {}
        
        return JSONResponse(content={
            "success": True,
            "message": "Profile updated successfully",
            "profile": {
                "uid": user['uid'],
                "email": user.get("email"),
                "username": updated_data.get("username", ""),
                "photo_url": updated_data.get("photo_url", ""),
                "bio": updated_data.get("bio", ""),
                "location": updated_data.get("location", "")
            }
        })
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/api/user/liked-trips")
async def get_liked_trips(user = Depends(get_current_user)):
    """Get all trips that the user has liked"""
    try:
        likes_ref = db.collection("trip_likes").where("user_id", "==", user['uid'])
        likes = likes_ref.stream()
        
        liked_trips = []
        for like in likes:
            like_data = like.to_dict()
            trip_id = like_data.get("trip_id")
            
            trip_doc = db.collection("trips").document(trip_id).get()
            if trip_doc.exists:
                trip_data = trip_doc.to_dict()
                if trip_data.get("is_public"):
                    liked_trips.append({
                        "trip_id": trip_id,
                        "destination": trip_data.get("destination"),
                        "duration": trip_data.get("duration"),
                        "cover_image": trip_data.get("cover_image"),
                        "trip_name": trip_data.get("trip_plan", {}).get("trip_name", ""),
                        "likes_count": trip_data.get("likes_count", 0),
                        "views_count": trip_data.get("views_count", 0)
                    })
        
        return JSONResponse(content={"success": True, "liked_trips": liked_trips})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.get("/api/user/{user_id}/badges")
async def get_badges(user_id: str):
    """Get badges for a user"""
    try:
        badges = get_user_badges(user_id)
        stats = calculate_user_stats(user_id)
        
        earned_count = sum(1 for b in badges if b.get("earned"))
        
        return JSONResponse(content={
            "badges": badges,
            "earned_count": earned_count,
            "total_count": len(badges),
            "stats": stats
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/api/user/{user_id}/stats")
async def get_user_stats(user_id: str):
    """Get detailed stats for a user"""
    try:
        stats = calculate_user_stats(user_id)
        badges = get_user_badges(user_id)
        earned_badges = [b for b in badges if b.get("earned")]
        
        return JSONResponse(content={
            "stats": stats,
            "badges": earned_badges,
            "level": calculate_user_level(stats),
            "next_level_progress": calculate_level_progress(stats)
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/api/user/{user_id}/rewards")
async def get_user_rewards(user_id: str):
    """Get user's reward points and available rewards"""
    try:
        stats = calculate_user_stats(user_id)
        
        rewards = [
            {
                "id": "upgrade_1",
                "name": "Upgrade to Premium (1 month)",
                "cost": 100,
                "description": "Unlock premium features for 1 month"
            },
            {
                "id": "custom_badge",
                "name": "Custom Badge",
                "cost": 50,
                "description": "Create your own custom badge"
            }
        ]
        
        return JSONResponse(content={
            "stars": stats.get("total_stars", 0),
            "rewards": rewards
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/user/redeem-reward")
async def redeem_reward(request: Request, user = Depends(get_current_user)):
    """Redeem a reward using stars"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        data = await request.json()
        reward_id = data.get("reward_id")
        
        stats = calculate_user_stats(user['uid'])
        available_stars = stats.get("total_stars", 0)
        
        # Implement reward redemption logic here
        return JSONResponse(content={"message": "Reward redeemed", "remaining_stars": available_stars})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
