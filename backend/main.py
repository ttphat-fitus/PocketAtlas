from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
load_dotenv('.env.local')
load_dotenv()

# Import routers
from routers.trips import router as trips_router
from routers.profile import router as profile_router
from routers.blog import router as blog_router
from routers.catalog import router as catalog_router
from firebase import get_current_user

# Initialize FastAPI app
app = FastAPI(
    title="Pocket Atlas API",
    description="AI-powered travel planning API",
    version="2.0.0"
)

# CORS configuration - Allow both local and production URLs
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Define allowed origins based on environment
allowed_origins = [
    "http://localhost:3000",  # Local development
    "http://127.0.0.1:3000",  # Local IP
    "https://pocketatlas.vercel.app",  # Main Vercel production
    "https://pocketatlas.studev.id.vn/",  # GCP frontend 
]

# Add production URLs if configured
if ENVIRONMENT == "production" and FRONTEND_URL != "http://localhost:3000":
    allowed_origins.append(FRONTEND_URL)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(trips_router, tags=["Trips"])
app.include_router(profile_router, tags=["Profile"])
app.include_router(blog_router, tags=["Blog"])
app.include_router(catalog_router, tags=["Catalog"])


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Pocket Atlas API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
        "environment": ENVIRONMENT,
        "cors_origins": allowed_origins
    }


@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {}


@app.get("/api/test-auth")
async def test_auth(user = Depends(get_current_user)):
    """Test endpoint to verify authentication"""
    return {
        "status": "authenticated",
        "user_id": user["uid"],
        "email": user["email"],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "environment": ENVIRONMENT}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
