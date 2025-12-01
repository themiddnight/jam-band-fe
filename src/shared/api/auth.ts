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
  token: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: User;
}

export interface GetCurrentUserResponse {
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
  // Store token
  if (result.token) {
    localStorage.setItem("auth_token", result.token);
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

// Logout (removes token)
export async function logout(): Promise<{ message: string }> {
  try {
    await axiosInstance.post(endpoints.logout);
  } catch {
    // Continue even if request fails
  }
  localStorage.removeItem("auth_token");
  return { message: "Logged out successfully" };
}

// Get stored token
export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

// Set token
export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

// Remove token
export function removeToken(): void {
  localStorage.removeItem("auth_token");
}

