import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import * as authAPI from "../api/auth";
import type { RegisterRequest, LoginRequest } from "../api/auth";

export function useAuth() {
  const navigate = useNavigate();
  const { login, logout: logoutStore, updateAuthUser, isAuthenticated, authUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (data: RegisterRequest) => {
      setLoading(true);
      setError(null);
      try {
        await authAPI.register(data);
        // After registration, user needs to verify email
        return { success: true };
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || "Registration failed");
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginUser = useCallback(
    async (data: LoginRequest) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authAPI.login(data);
        login(result.user, result.accessToken);
        return { success: true };
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || "Login failed");
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [login]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authAPI.logout();
      logoutStore();
      navigate("/");
    } catch {
      // Continue with logout even if API call fails
      logoutStore();
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [logoutStore, navigate]);

  const verifyEmail = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authAPI.verifyEmail(token);
      if (isAuthenticated && authUser?.id === result.user.id) {
        updateAuthUser(result.user);
      }
      return { success: true, user: result.user };
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Email verification failed");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authUser, updateAuthUser]);

  const resendVerification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authAPI.resendVerification();
      return { success: true };
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to resend verification");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await authAPI.forgotPassword(email);
      return { success: true };
    } catch {
      // Always return success to prevent email enumeration
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      await authAPI.resetPassword(token, newPassword);
      return { success: true };
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Password reset failed");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(() => {
    authAPI.loginWithGoogle();
  }, []);

  const checkAuth = useCallback(async () => {
    const token = authAPI.getToken();
    if (!token) {
      return;
    }

    try {
      const result = await authAPI.getCurrentUser();
      login(result.user, token);
    } catch {
      // Token is invalid, remove it
      authAPI.removeToken();
      logoutStore();
    }
  }, [login, logoutStore]);

  return {
    register,
    login: loginUser,
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    checkAuth,
    loading,
    error,
    clearError: () => setError(null),
  };
}

export function useRequireAuth() {
  const { isAuthenticated } = useUserStore();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate("/login");
  }

  return isAuthenticated;
}

export function useGuestMode() {
  const { setAsGuest } = useUserStore();

  const enterAsGuest = useCallback(() => {
    setAsGuest();
  }, [setAsGuest]);

  return { enterAsGuest };
}

