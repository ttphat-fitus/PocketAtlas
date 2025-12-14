// Client-side API helper.
// IMPORTANT: Client code must call Next.js route handlers under /api (proxy to backend).

export const API_BASE_URL = "/api";

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/api" || normalizedPath.startsWith("/api/")) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
};

export default API_BASE_URL;
