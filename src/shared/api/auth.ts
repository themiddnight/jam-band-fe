import axiosInstance from "../utils/axiosInstance";
import { endpoints } from "../utils/endpoints";

export interface User {
  id: string;
  email: string | null;
  username: string | null;
  userType: "GUEST" | "REGISTERED" | "PREMIUM";
  emailVerified: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: User;
}

export interface GetCurrentUserResponse {
  user: User;
}

export interface UpdateUsernameRequest {
  username: string;
}

export interface UpdateUsernameResponse {
  message: string;
  user: User;
}

// Register with email and password
export async function register(
  data: RegisterRequest
): Promise<RegisterResponse> {
  const response = await axiosInstance.post(endpoints.register, data);
  return response.data;
}

// Login with email and password
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await axiosInstance.post(endpoints.login, data);
  const result = response.data;
  // Store tokens
  if (result.accessToken) {
    localStorage.setItem("auth_token", result.accessToken);
  }
  if (result.refreshToken) {
    localStorage.setItem("refresh_token", result.refreshToken);
  }
  return result;
}

// Verify email with token
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const response = await axiosInstance.get(endpoints.verifyEmail(token));
  return response.data;
}

// Resend verification email
export async function resendVerification(): Promise<{ message: string }> {
  const response = await axiosInstance.post(endpoints.resendVerification);
  return response.data;
}

// Request password reset
export async function forgotPassword(
  email: string
): Promise<{ message: string }> {
  const response = await axiosInstance.post(endpoints.forgotPassword, {
    email,
  });
  return response.data;
}

// Reset password with token
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const response = await axiosInstance.post(endpoints.resetPassword, {
    token,
    newPassword,
  });
  return response.data;
}

// Login with Google (redirects to Google OAuth)
export function loginWithGoogle(): void {
  window.location.href = endpoints.googleAuth;
}

// Get current authenticated user
export async function getCurrentUser(): Promise<GetCurrentUserResponse> {
  const response = await axiosInstance.get(endpoints.getCurrentUser);
  return response.data;
}

// Update username
export async function updateUsername(
  username: string
): Promise<UpdateUsernameResponse> {
  const response = await axiosInstance.put(endpoints.updateUsername, {
    username,
  });
  return response.data;
}

// Refresh access token
export async function refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  const response = await axiosInstance.post(endpoints.refreshToken, { refreshToken });
  const result = response.data;
  localStorage.setItem("auth_token", result.accessToken);
  localStorage.setItem("refresh_token", result.refreshToken);
  return result;
}

// Logout (removes tokens)
export async function logout(): Promise<{ message: string }> {
  try {
    await axiosInstance.post(endpoints.logout);
  } catch {
    // Continue even if request fails
  }
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");
  return { message: "Logged out successfully" };
}

// Get stored access token
export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

// Get stored refresh token
export function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

// Set access token
export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

// Set refresh token
export function setRefreshToken(token: string): void {
  localStorage.setItem("refresh_token", token);
}

// Remove tokens
export function removeToken(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");
}

// Feedback state types
export interface FeedbackState {
  feedbackSubmittedAt: string | null;
  feedbackDismissedAt: string | null;
}

export interface UpdateFeedbackStateRequest {
  action: "submitted" | "dismissed";
}

// Get feedback state
export async function getFeedbackState(): Promise<FeedbackState> {
  const response = await axiosInstance.get(endpoints.getFeedbackState);
  return response.data;
}

// Update feedback state
export async function updateFeedbackState(
  action: "submitted" | "dismissed"
): Promise<{ user: { id: string; feedbackSubmittedAt: string | null; feedbackDismissedAt: string | null } }> {
  const response = await axiosInstance.put(endpoints.updateFeedbackState, {
    action,
  });
  return response.data;
}

