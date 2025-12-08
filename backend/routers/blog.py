"""Blog management router"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from datetime import datetime
import re

from firebase import get_current_user
from core.database import db, firestore
from models.blog import BlogCreateRequest, BlogGenerateRequest, CommentCreate
from services.ai import generate_blog_from_trip

router = APIRouter()


@router.post("/api/blog/create")
async def create_blog_post(blog_data: BlogCreateRequest, user = Depends(get_current_user)):
    """Create a new blog post"""
    try:
        blog_id = f"{user['uid']}_{int(datetime.now().timestamp())}"
        slug = re.sub(r'[^a-z0-9]+', '-', blog_data.title.lower()).strip('-')
        
        user_doc = db.collection("users").document(user["uid"]).get()
        author_name = "Anonymous"
        if user_doc.exists:
            user_data = user_doc.to_dict()
            author_name = user_data.get("username", user.get("email", "Anonymous"))
        
        blog_post = {
            "id": blog_id,
            "user_id": user['uid'],
            "author": author_name,
            "title": blog_data.title,
            "title_vi": blog_data.title_vi or blog_data.title,
            "slug": slug,
            "excerpt": blog_data.excerpt,
            "excerpt_vi": blog_data.excerpt_vi or blog_data.excerpt,
            "content": blog_data.content,
            "content_vi": blog_data.content_vi or blog_data.content,
            "category": blog_data.category,
            "tags": blog_data.tags,
            "cover_image": blog_data.cover_image,
            "trip_id": blog_data.trip_id,
            "date": datetime.now().isoformat(),
            "views": 0,
            "likes": 0,
            "is_published": True,
        }
        
        db.collection("blogs").document(blog_id).set(blog_post)
        
        return JSONResponse(content={"success": True, "slug": slug, "id": blog_id})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to create blog post", "details": str(e)})


@router.post("/api/blog/generate-from-trip")
async def generate_blog_from_trip_endpoint(request: BlogGenerateRequest, user = Depends(get_current_user)):
    """Generate blog content from a trip using AI"""
    try:
        trip_ref = db.collection("trips").where("user_id", "==", user['uid']).where("id", "==", request.trip_id).limit(1)
        trips = list(trip_ref.stream())
        
        if not trips:
            return JSONResponse(status_code=404, content={"error": "Trip not found"})
        
        trip_data = trips[0].to_dict()
        blog_content = await generate_blog_from_trip(trip_data)
        
        return JSONResponse(content={"success": True, "blog": blog_content})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to generate blog", "details": str(e)})


@router.get("/api/blogs")
async def get_blogs(page: int = 1, limit: int = 10):
    """Get published blog posts"""
    try:
        blogs_ref = db.collection("blogs").where("is_published", "==", True)
        blogs = blogs_ref.stream()
        
        blogs_list = []
        for blog in blogs:
            blog_data = blog.to_dict()
            blogs_list.append({
                "id": blog.id,
                "title": blog_data.get("title"),
                "title_vi": blog_data.get("title_vi"),
                "slug": blog_data.get("slug"),
                "excerpt": blog_data.get("excerpt"),
                "excerpt_vi": blog_data.get("excerpt_vi"),
                "author": blog_data.get("author"),
                "date": blog_data.get("date"),
                "cover_image": blog_data.get("cover_image"),
                "category": blog_data.get("category"),
                "tags": blog_data.get("tags"),
                "views": blog_data.get("views", 0),
                "likes": blog_data.get("likes", 0),
            })
        
        # Sort by date in Python (descending)
        blogs_list.sort(key=lambda x: x.get("date", ""), reverse=True)
        
        # Apply pagination in Python
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_blogs = blogs_list[start_idx:end_idx]
        
        return JSONResponse(content={"blogs": paginated_blogs})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch blogs", "details": str(e)})


@router.post("/api/blog/{blog_id}/vote")
async def vote_blog(blog_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Upvote or downvote a blog post"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        data = await request.json()
        vote_type = data.get("vote_type")
        
        if vote_type not in ["up", "down"]:
            return JSONResponse(status_code=400, content={"error": "Invalid vote type"})
        
        blog_ref = db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        
        if not blog_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Blog not found"})
        
        blog_data = blog_doc.to_dict()
        
        votes_ref = db.collection("blog_votes").where("blog_id", "==", blog_id).where("user_id", "==", user["uid"])
        existing_votes = list(votes_ref.stream())
        
        if existing_votes:
            old_vote = existing_votes[0]
            old_vote_data = old_vote.to_dict()
            
            if old_vote_data.get("vote_type") == vote_type:
                return JSONResponse(content={"message": "Already voted"})
            
            old_vote.reference.delete()
            
            if old_vote_data.get("vote_type") == "up":
                blog_ref.update({"upvotes": max(0, blog_data.get("upvotes", 0) - 1)})
            else:
                blog_ref.update({"downvotes": max(0, blog_data.get("downvotes", 0) - 1)})
        
        vote_id = f"{blog_id}_{user['uid']}"
        db.collection("blog_votes").document(vote_id).set({
            "blog_id": blog_id,
            "user_id": user["uid"],
            "vote_type": vote_type,
            "created_at": datetime.now().isoformat()
        })
        
        if vote_type == "up":
            blog_ref.update({"upvotes": blog_data.get("upvotes", 0) + 1})
        else:
            blog_ref.update({"downvotes": blog_data.get("downvotes", 0) + 1})
        
        return JSONResponse(content={"message": "Vote added", "vote_type": vote_type})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/api/blog/{blog_id}/comments")
async def get_blog_comments(blog_id: str):
    """Get comments for a blog post"""
    try:
        comments_ref = db.collection("blog_comments").where("blog_id", "==", blog_id)
        comments = comments_ref.stream()
        
        comments_list = []
        for comment in comments:
            comment_data = comment.to_dict()
            comments_list.append({
                "id": comment.id,
                "user_id": comment_data.get("user_id"),
                "user_name": comment_data.get("user_name"),
                "user_photo": comment_data.get("user_photo"),
                "content": comment_data.get("content"),
                "created_at": comment_data.get("created_at"),
                "likes": comment_data.get("likes", 0),
            })
        
        # Sort by created_at in Python (descending)
        comments_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return JSONResponse(content={"comments": comments_list})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/api/blog/{blog_id}/comments")
async def add_blog_comment(blog_id: str, comment: CommentCreate, user: dict = Depends(get_current_user)):
    """Add a comment to a blog post"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        user_doc = db.collection("users").document(user["uid"]).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        
        comment_id = f"{blog_id}_{user['uid']}_{int(datetime.now().timestamp())}"
        comment_data = {
            "blog_id": blog_id,
            "user_id": user["uid"],
            "user_name": user_data.get("username", user.get("email", "Anonymous")),
            "user_photo": user_data.get("photo_url", ""),
            "content": comment.content,
            "created_at": datetime.now().isoformat(),
            "likes": 0,
        }
        
        db.collection("blog_comments").document(comment_id).set(comment_data)
        
        blog_ref = db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        if blog_doc.exists:
            blog_ref.update({"comments_count": blog_doc.to_dict().get("comments_count", 0) + 1})
        
        return JSONResponse(content={"message": "Comment added", "comment": {**comment_data, "id": comment_id}})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.delete("/api/blog/{blog_id}/comments/{comment_id}")
async def delete_blog_comment(blog_id: str, comment_id: str, user: dict = Depends(get_current_user)):
    """Delete a comment"""
    if not user:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    
    try:
        comment_ref = db.collection("blog_comments").document(comment_id)
        comment_doc = comment_ref.get()
        
        if not comment_doc.exists:
            return JSONResponse(status_code=404, content={"error": "Comment not found"})
        
        comment_data = comment_doc.to_dict()
        if comment_data.get("user_id") != user["uid"]:
            return JSONResponse(status_code=403, content={"error": "Not authorized to delete this comment"})
        
        comment_ref.delete()
        
        blog_ref = db.collection("blogs").document(blog_id)
        blog_doc = blog_ref.get()
        if blog_doc.exists:
            blog_ref.update({"comments_count": max(0, blog_doc.to_dict().get("comments_count", 0) - 1)})
        
        return JSONResponse(content={"message": "Comment deleted"})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
