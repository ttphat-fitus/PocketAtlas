"""Trip-related Pydantic models"""
from pydantic import BaseModel
from typing import Optional


class TripRequest(BaseModel):
    destination: str
    duration: int
    budget: str
    start_date: str
    preferences: Optional[str] = ""
    activity_level: Optional[str] = "medium"
    travel_group: Optional[str] = "solo"
    group_size: Optional[int] = None
    travel_mode: Optional[str] = ""
    categories: Optional[list] = []
    active_time_start: Optional[int] = 8
    active_time_end: Optional[int] = 22


class RatingRequest(BaseModel):
    rating: int


class ViewRequest(BaseModel):
    user_id: str


class CoverImageRequest(BaseModel):
    cover_image: str


class UpdateTripPlanRequest(BaseModel):
    trip_plan: dict


class TogglePublicRequest(BaseModel):
    is_public: bool
    category_tags: Optional[list] = []
    cover_image: Optional[str] = None


class LikeRequest(BaseModel):
    user_id: str
