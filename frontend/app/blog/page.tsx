"use client";

import { useLanguage } from "../../contexts/LanguageContext";
import { blogPosts } from "../../lib/blogData";

export default function BlogPage() {
  const { language, setLanguage } = useLanguage();

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
          <div className="flex gap-1 mr-4">
            <button
              onClick={() => setLanguage("en")}
              className={`btn btn-sm ${language === "en" ? "btn-primary" : "btn-ghost"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("vi")}
              className={`btn btn-sm ${language === "vi" ? "btn-primary" : "btn-ghost"}`}
            >
              VI
            </button>
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

        {/* Blog Grid */}
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
