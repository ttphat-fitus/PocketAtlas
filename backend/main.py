from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from routers.trips import router as trips_router
from routers.profile import router as profile_router
from routers.blog import router as blog_router
from routers.catalog import router as catalog_router

# Initialize FastAPI app
app = FastAPI(
    title="Pocket Atlas API",
    description="AI-powered travel planning API",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
