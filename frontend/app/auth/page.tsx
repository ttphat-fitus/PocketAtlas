"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, signInAnon, signInWithGoogle, isConfigured } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      router.push("/trip/input");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymous = async () => {
    setLoading(true);
    try {
      await signInAnon();
      router.push("/trip/input");
    } catch (err: any) {
      setError(err.message || "Failed to sign in anonymously");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/trip/input");
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Toggle */}
        <div className="flex justify-end mb-4 gap-2">
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

        {!isConfigured && (
          <div className="alert alert-warning mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm">
              {language === "en" 
                ? "Firebase is not configured. Please check .env.local and FIREBASE_SETUP.md"
                : "Firebase chưa được cấu hình. Vui lòng kiểm tra .env.local và FIREBASE_SETUP.md"}
            </span>
          </div>
        )}

        <div className="card bg-white shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl font-bold text-center mb-6">
              {t("home.title")}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      {language === "en" ? "Name" : "Tên"}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={language === "en" ? "Your name" : "Tên của bạn"}
                    className="input input-bordered w-full"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              )}

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Email</span>
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    {language === "en" ? "Password" : "Mật khẩu"}
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner"></span>
                ) : isSignUp ? (
                  language === "en" ? "Sign Up" : "Đăng ký"
                ) : (
                  language === "en" ? "Sign In" : "Đăng nhập"
                )}
              </button>
            </form>

            <div className="divider">
              {language === "en" ? "OR" : "HOẶC"}
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="btn btn-outline w-full gap-2"
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {language === "en" ? "Continue with Google" : "Tiếp tục với Google"}
            </button>

            <div className="divider">
              {language === "en" ? "OR" : "HOẶC"}
            </div>

            <button
              onClick={handleAnonymous}
              className="btn btn-outline w-full"
              disabled={loading}
            >
              {language === "en" ? "Continue as Guest" : "Tiếp tục với Khách"}
            </button>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="btn btn-ghost btn-sm w-full mt-4"
            >
              {isSignUp
                ? language === "en"
                  ? "Already have an account? Sign In"
                  : "Đã có tài khoản? Đăng nhập"
                : language === "en"
                ? "Don't have an account? Sign Up"
                : "Chưa có tài khoản? Đăng ký"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
