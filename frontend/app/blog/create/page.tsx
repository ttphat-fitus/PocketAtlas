"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";

interface BlogFormData {
  title: string;
  title_vi: string;
  excerpt: string;
  excerpt_vi: string;
  content: string;
  content_vi: string;
  category: string;
  tags: string[];
  cover_image: string;
  trip_id?: string;
}

const CATEGORIES = [
  "Travel Tips",
  "Destination Guide",
  "Food & Cuisine",
  "Culture & History",
  "Budget Travel",
  "Adventure",
  "Relaxation",
];

export default function CreateBlogPage() {
  const router = useRouter();
  const { user, loading: authLoading, getIdToken } = useAuth();
  
  const [formData, setFormData] = useState<BlogFormData>({
    title: "",
    title_vi: "",
    excerpt: "",
    excerpt_vi: "",
    content: "",
    content_vi: "",
    category: "Travel Tips",
    tags: [],
    cover_image: "",
    trip_id: "",
  });
  
  const [tagInput, setTagInput] = useState("");
  const [trips, setTrips] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Fetch user's trips for linking
  useEffect(() => {
    const fetchTrips = async () => {
      if (!user) return;
      
      try {
        const token = await getIdToken();
        const response = await fetch("http://localhost:8000/api/my-trips", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setTrips(data.trips || []);
        }
      } catch (err) {
        console.error("Failed to fetch trips:", err);
      }
    };
    
    if (user) fetchTrips();
  }, [user, getIdToken]);

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleGenerateWithAI = async () => {
    if (!formData.trip_id) {
      alert("Vui lòng chọn chuyến đi để tạo nội dung blog");
      return;
    }

    setAiGenerating(true);
    
    try {
      const token = await getIdToken();
      const response = await fetch(`http://localhost:8000/api/blog/generate-from-trip`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trip_id: formData.trip_id }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({
          ...formData,
          title: data.title || "",
          title_vi: data.title_vi || "",
          excerpt: data.excerpt || "",
          excerpt_vi: data.excerpt_vi || "",
          content: data.content || "",
          content_vi: data.content_vi || "",
          cover_image: data.cover_image || "",
          tags: data.tags || [],
        });
      } else {
        alert("Không thể tạo nội dung blog. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error generating blog:", err);
      alert("Đã xảy ra lỗi khi tạo nội dung.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content) {
      alert("Vui lòng điền các trường bắt buộc (Tiêu đề và Nội dung)");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = await getIdToken();
      const response = await fetch("http://localhost:8000/api/blog/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/blog/${data.slug}`);
      } else {
        alert("Không thể tạo bài blog. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Error creating blog:", err);
      alert("Đã xảy ra lỗi khi tạo bài blog.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Navbar */}
      <div className="navbar bg-white shadow-sm sticky top-0 z-50">
        <div className="navbar-start">
          <a href="/blog" className="btn btn-ghost gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Blog
          </a>
        </div>
        <div className="navbar-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500">
            Tạo Bài Blog
          </h1>
        </div>
        <div className="navbar-end">
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* AI Generation Option */}
        <div className="card bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 shadow-lg mb-6 border border-purple-200">
          <div className="card-body p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  Tạo Blog bằng AI
                  <span className="badge badge-primary badge-sm">MỚI</span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Tự động tạo nội dung blog từ trải nghiệm chuyến đi của bạn
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-4">
              <select
                className="select select-bordered flex-1 min-w-[250px] bg-white"
                value={formData.trip_id}
                onChange={(e) => setFormData({ ...formData, trip_id: e.target.value })}
              >
                <option value="">
                  Chọn chuyến đi...
                </option>
                {trips.map((trip) => (
                  <option key={trip.trip_id} value={trip.trip_id}>
                    {trip.trip_name || trip.destination}
                  </option>
                ))}
              </select>
              
              <button
                onClick={handleGenerateWithAI}
                disabled={!formData.trip_id || aiGenerating}
                className="btn bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:from-purple-600 hover:to-pink-600 gap-2 shadow-md"
              >
                {aiGenerating ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Tạo bằng AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Blog Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Cover Image */}
          <div className="card bg-white shadow-md hover:shadow-lg transition-shadow">
            <div className="card-body p-4">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <span className="badge badge-primary">1</span>
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Ảnh Bìa
              </h3>
              
              <input
                type="url"
                placeholder="https://..."
                className="input input-bordered w-full input-sm mb-2"
                value={formData.cover_image}
                onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
              />
              
              {formData.cover_image && (
                <div className="relative rounded-lg overflow-hidden h-32 group">
                  <img 
                    src={formData.cover_image} 
                    alt="Cover preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x300?text=Invalid+Image+URL";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, cover_image: "" })}
                    className="absolute top-2 right-2 btn btn-circle btn-sm btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Title & Summary */}
          <div className="card bg-white shadow-md hover:shadow-lg transition-shadow">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span className="badge badge-primary">2</span>
                <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Tiêu đề & Tóm tắt
                </h3>
                {/* <div className="flex gap-2">
                  <button type="button" onClick={() => setUseAI(false)} className={`btn btn-xs ${useAI === false ? 'btn-primary' : 'btn-ghost'}`}>EN</button>
                  <button type="button" onClick={() => setUseAI(true)} className={`btn btn-xs ${useAI === true ? 'btn-primary' : 'btn-ghost'}`}>VI</button>
                </div> */}
              </div>

              {/* {useAI === false ? (
                <div className="space-y-3">
                  <div className="form-control">
                    <input
                      type="text"
                      placeholder="Title (English)"
                      className="input input-bordered input-sm"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Summary (English)"
                    className="textarea textarea-bordered textarea-sm h-20"
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  />
                </div>
              ) : ( */}
                <div className="space-y-3">
                  <div className="form-control">
                    <input
                      type="text"
                      placeholder="Tiêu đề"
                      className="input input-bordered input-sm w-full"
                      value={formData.title_vi}
                      onChange={(e) => setFormData({ ...formData, title_vi: e.target.value })}
                    />
                  </div>
                  <textarea
                    placeholder="Tóm tắt"
                    className="textarea textarea-bordered h-32 w-full font-mono text-sm"
                    value={formData.excerpt_vi}
                    onChange={(e) => setFormData({ ...formData, excerpt_vi: e.target.value })}
                  />
                </div>

            </div>
          </div>

          {/* Step 3: Category & Tags */}
          <div className="card bg-white shadow-md hover:shadow-lg transition-shadow">
            <div className="card-body p-4">
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <span className="badge badge-primary">3</span>
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Danh mục & Thẻ
              </h3>

              <div className="w-full mb-3">
                <select
                  className="select select-bordered select-sm w-full"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="badge badge-sm badge-primary gap-1">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-error">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Content */}
          <div className="card bg-white shadow-md hover:shadow-lg transition-shadow">
            <div className="card-body p-4">
              <h3 className="font-bold text-base flex items-center gap-2 mb-3">
                <span className="badge badge-primary">4</span>
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Nội dung (Markdown)
              </h3>

              <textarea
                placeholder="Viết nội dung bằng định dạng Markdown..."
                className="textarea textarea-bordered h-96 w-full font-mono text-sm"
                value={formData.content_vi || formData.content}
                onChange={(e) => setFormData({ ...formData, content_vi: e.target.value, content: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end sticky bottom-4 z-10">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-outline btn-sm gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:from-purple-600 hover:to-pink-600 gap-2 shadow-lg btn-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Đang đăng...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Đăng
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
