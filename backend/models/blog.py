"""Blog-related Pydantic models"""
from pydantic import BaseModel
from typing import Optional


class BlogCreateRequest(BaseModel):
    title: str
    title_vi: Optional[str] = ""
    excerpt: Optional[str] = ""
    excerpt_vi: Optional[str] = ""
    content: str
    content_vi: Optional[str] = ""
    category: Optional[str] = "Travel Tips"
    tags: Optional[list] = []
    cover_image: Optional[str] = ""
    trip_id: Optional[str] = ""


class BlogGenerateRequest(BaseModel):
    trip_id: str


class CommentCreate(BaseModel):
    content: str
