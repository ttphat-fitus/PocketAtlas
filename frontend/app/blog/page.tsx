"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { blogPosts } from "../../lib/blogData";

interface BlogPost {
  id: string;
  title: string;
  title_vi: string;
  excerpt: string;
  excerpt_vi: string;
  content: string;
  content_vi: string;
  category: string;
  tags: string[];
  cover_image: string;
  author_id: string;
  author_name: string;
  slug: string;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  is_featured?: boolean;
}

export default function BlogPage() {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [userBlogs, setUserBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const response = await fetch("/api/blog");
        if (response.ok) {
          const data = await response.json();
          setUserBlogs(data.blogs || []);
        }
      } catch (err) {
        console.error("Failed to fetch blogs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  // Combine static and dynamic blogs
  const allBlogs = [...blogPosts, ...userBlogs];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-sm">
        <div className="navbar-start">
          <a href="/" className="btn btn-ghost text-xl">
            ← {language === "en" ? "Back" : "Quay lại"}
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
            {language === "en" ? "Travel Blog" : "Blog Du Lịch"}
          </a>
        </div>

        <div className="navbar-end">
          <div className="flex gap-2 mr-4">
            {user && (
              <a href="/blog/create" className="btn btn-primary btn-sm gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Viết bài
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {language === "en" ? "Travel Tips & Guides" : "Mẹo & Hướng Dẫn Du Lịch"}
          </h1>
          <p className="text-gray-600 text-lg">
            {language === "en"
              ? "Discover expert travel advice, destination guides, and insider tips for your next adventure"
              : "Khám phá lời khuyên chuyên gia, hướng dẫn điểm đến và mẹo nội bộ cho cuộc phiêu lưu tiếp theo của bạn"}
          </p>
          
          {/* CTA for non-logged users */}
          {!user && (
            <div className="mt-6">
              <a href="/auth" className="btn btn-primary gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {language === "en" ? "Sign in to write your story" : "Đăng nhập để viết bài của bạn"}
              </a>
            </div>
          )}
        </div>

        {/* Featured Post */}
        {blogPosts.length > 0 && (
          <div className="mb-12">
            <div className="card bg-white shadow-xl lg:card-side">
              <figure className="lg:w-1/2">
                <img
                  src={blogPosts[0].image}
                  alt={language === "en" ? blogPosts[0].title : blogPosts[0].title_vi}
                  className="w-full h-full object-cover"
                />
              </figure>
              <div className="card-body lg:w-1/2">
                <div className="badge badge-primary mb-2">{language === "en" ? "Featured" : "Nổi bật"}</div>
                <h2 className="card-title text-2xl">
                  {language === "en" ? blogPosts[0].title : blogPosts[0].title_vi}
                </h2>
                <p className="text-gray-600">
                  {language === "en" ? blogPosts[0].excerpt : blogPosts[0].excerpt_vi}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                  <span>{blogPosts[0].author}</span>
                  <span>•</span>
                  <span>{new Date(blogPosts[0].date).toLocaleDateString(language === "en" ? "en-US" : "vi-VN")}</span>
                </div>
                <div className="card-actions justify-end mt-4">
                  <a href={`/blog/${blogPosts[0].slug}`} className="btn btn-primary">
                    {language === "en" ? "Read More" : "Đọc thêm"} →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Blogs Section */}
        {userBlogs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {language === "en" ? "Community Stories" : "Bài viết từ cộng đồng"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userBlogs.map((post) => (
                <div key={post.id} className="card bg-white shadow-md hover:shadow-xl transition-shadow">
                  <figure>
                    <img
                      src={post.cover_image || "https://picsum.photos/seed/" + post.id + "/800/600"}
                      alt={language === "en" ? post.title : post.title_vi}
                      className="w-full h-48 object-cover"
                    />
                  </figure>
                  <div className="card-body">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="badge badge-secondary badge-sm">{post.category}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                        {post.upvotes || 0}
                        <svg className="w-3 h-3 text-red-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                        </svg>
                        {post.downvotes || 0}
                      </div>
                    </div>
                    <h3 className="card-title text-lg">
                      {language === "en" ? post.title : (post.title_vi || post.title)}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {language === "en" ? post.excerpt : (post.excerpt_vi || post.excerpt)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <span>{post.author_name || "Anonymous"}</span>
                      <span>•</span>
                      <span>{new Date(post.created_at).toLocaleDateString(language === "en" ? "en-US" : "vi-VN")}</span>
                      {post.comments_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {post.comments_count}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="card-actions justify-end mt-4">
                      <a href={`/blog/${post.slug}`} className="btn btn-sm btn-outline btn-primary">
                        {language === "en" ? "Read More" : "Đọc thêm"}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Static Blog Grid */}
        <h2 className="text-2xl font-bold mb-6">
          {language === "en" ? "Expert Guides" : "Hướng dẫn chuyên gia"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.slice(1).map((post) => (
            <div key={post.id} className="card bg-white shadow-md hover:shadow-xl transition-shadow">
              <figure>
                <img
                  src={post.image}
                  alt={language === "en" ? post.title : post.title_vi}
                  className="w-full h-48 object-cover"
                />
              </figure>
              <div className="card-body">
                <div className="badge badge-secondary badge-sm mb-2">{post.category}</div>
                <h3 className="card-title text-lg">
                  {language === "en" ? post.title : post.title_vi}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-3">
                  {language === "en" ? post.excerpt : post.excerpt_vi}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                  <span>{post.author}</span>
                  <span>•</span>
                  <span>{new Date(post.date).toLocaleDateString(language === "en" ? "en-US" : "vi-VN")}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="badge badge-outline badge-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="card-actions justify-end mt-4">
                  <a href={`/blog/${post.slug}`} className="btn btn-sm btn-outline btn-primary">
                    {language === "en" ? "Read More" : "Đọc thêm"}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
