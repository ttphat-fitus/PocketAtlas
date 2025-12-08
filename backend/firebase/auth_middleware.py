from fastapi import Header, HTTPException, Depends
from typing import Optional
from firebase_admin import auth as firebase_auth

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    
    token = parts[1]
    
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "displayName": decoded_token.get("name") or decoded_token.get("email", "").split("@")[0],
            "photoURL": decoded_token.get("picture", ""),
            "is_anonymous": decoded_token.get("firebase", {}).get("sign_in_provider") == "anonymous",
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
