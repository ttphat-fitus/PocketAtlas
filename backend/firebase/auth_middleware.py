from fastapi import Header, HTTPException, Depends
from typing import Optional
from .firebase_config import get_auth

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        print("[AUTH] Missing Authorization header")
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        print(f"[AUTH] Invalid Authorization format: {parts}")
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    
    token = parts[1]
    
    try:
        firebase_auth = get_auth()
        
        if firebase_auth is None:
            print("[AUTH] Firebase auth not initialized - credentials may be missing")
            raise HTTPException(
                status_code=500, 
                detail="Firebase authentication not configured. Please contact administrator."
            )
        
        print(f"[AUTH] Attempting to verify token...")
        decoded_token = firebase_auth.verify_id_token(token)
        print(f"[AUTH] Token verified for user: {decoded_token.get('uid')}")
        return {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "displayName": decoded_token.get("name") or decoded_token.get("email", "").split("@")[0],
            "photoURL": decoded_token.get("picture", ""),
            "is_anonymous": decoded_token.get("firebase", {}).get("sign_in_provider") == "anonymous",
        }
    except Exception as e:
        print(f"[AUTH] ✗ Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
