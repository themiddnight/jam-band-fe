import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - Add token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Auto refresh token on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        // No refresh token - user is either guest or not authenticated
        // Check if user is a guest by checking userStore state
        let isGuest = false;
        try {
          const userStore = localStorage.getItem("user-store");
          if (userStore) {
            const parsed = JSON.parse(userStore);
            // Zustand persist stores state directly, check both possible structures
            const userType = parsed.state?.userType || parsed.userType;
            const isAuthenticated = parsed.state?.isAuthenticated ?? parsed.isAuthenticated;
            isGuest = userType === "GUEST" || isAuthenticated === false;
          }
        } catch {
          // If we can't parse user store, check if on room page (likely a guest)
          const isOnRoomPage = window.location.pathname.includes('/perform/') || 
                              window.location.pathname.includes('/arrange/') ||
                              window.location.pathname.includes('/room/');
          if (isOnRoomPage) {
            // If on room page without refresh token, likely a guest - don't redirect
            isGuest = true;
          }
        }
        
        // If user is a guest, don't redirect to login - let them continue
        if (isGuest) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          processQueue(new Error("No refresh token"), null);
          isRefreshing = false;
          // Don't redirect guest users to login
          return Promise.reject(error);
        }
        
        // No refresh token and not a guest - logout user
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        processQueue(new Error("No refresh token"), null);
        isRefreshing = false;
        // Redirect to login only if not already on login page and not on room pages
        const isOnRoomPage = window.location.pathname.includes('/perform/') || 
                            window.location.pathname.includes('/arrange/') ||
                            window.location.pathname.includes('/room/');
        if (!window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/auth/callback') &&
            !isOnRoomPage) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      try {
        const { refreshToken: refreshTokenAPI } = await import("../api/auth");
        const { accessToken, refreshToken: newRefreshToken } = await refreshTokenAPI();
        
        localStorage.setItem("auth_token", accessToken);
        localStorage.setItem("refresh_token", newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        isRefreshing = false;
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        processQueue(refreshError, null);
        isRefreshing = false;
        // Redirect to login only if not already on login page and not on room pages
        const isOnRoomPage = window.location.pathname.includes('/perform/') || 
                            window.location.pathname.includes('/arrange/') ||
                            window.location.pathname.includes('/room/');
        if (!window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/auth/callback') &&
            !isOnRoomPage) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
