"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "../../../contexts/LanguageContext";
import { getBlogPost, type BlogPost } from "../../../lib/blogData";
import ReactMarkdown from "react-markdown";

export default function BlogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { language, setLanguage } = useLanguage();
  const [post, setPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    if (slug) {
      const foundPost = getBlogPost(slug);
      if (foundPost) {
        setPost(foundPost);
      } else {
        router.push("/blog");
      }
    }
  }, [slug, router]);

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-sm sticky top-0 z-50">
        <div className="navbar-start">
          <a href="/blog" className="btn btn-ghost">
            ← {language === "en" ? "Back to Blog" : "Quay lại Blog"}
          </a>
        </div>

        <div className="navbar-center">
          <a className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-teal-500 to-green-500">
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

      {/* Hero Image */}
      <div className="w-full h-96 overflow-hidden">
        <img
          src={post.image}
          alt={language === "en" ? post.title : post.title_vi}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="card bg-white shadow-xl -mt-32 relative z-10">
          <div className="card-body p-8 lg:p-12">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="badge badge-primary">{post.category}</span>
              {post.tags.map((tag) => (
                <span key={tag} className="badge badge-outline badge-sm">
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold mb-4">
              {language === "en" ? post.title : post.title_vi}
            </h1>

            {/* Author & Date */}
            <div className="flex items-center gap-4 text-gray-600 mb-8 pb-8 border-b">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>{post.author}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>{new Date(post.date).toLocaleDateString(language === "en" ? "en-US" : "vi-VN", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                  li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
                  code: ({ node, ...props }) => <code className="bg-gray-100 px-2 py-1 rounded text-sm" {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4" {...props} />,
                }}
              >
                {language === "en" ? post.content : post.content_vi}
              </ReactMarkdown>
            </div>

            {/* CTA */}
            <div className="mt-12 pt-8 border-t">
              <div className="bg-gradient-to-r from-blue-50 to-teal-50 p-6 rounded-lg text-center">
                <h3 className="text-2xl font-bold mb-2">
                  {language === "en" ? "Ready to plan your trip?" : "Sẵn sàng lên kế hoạch chuyến đi?"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {language === "en"
                    ? "Let AI create your perfect itinerary in minutes"
                    : "Để AI tạo lịch trình hoàn hảo trong vài phút"}
                </p>
                <a href="/trip/input" className="btn btn-primary btn-lg">
                  {language === "en" ? "Start Planning" : "Bắt đầu lập kế hoạch"} →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Blog */}
        <div className="text-center mt-8">
          <a href="/blog" className="btn btn-ghost">
            ← {language === "en" ? "Back to all posts" : "Quay lại tất cả bài viết"}
          </a>
        </div>
      </div>
    </div>
  );
}
