import axiosInstance from '../utils/axiosInstance';
import { endpoints } from '../utils/endpoints';

// Types for API responses
export interface Room {
  id: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  isHidden: boolean;
  createdAt: string;
  userCount: number;
}

export interface User {
  id: string;
  username: string;
  role: 'room_owner' | 'band_member' | 'audience';
  isReady: boolean;
  currentInstrument?: string;
  currentCategory?: string;
}

export type RoomListResponse = Room[];

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

export interface LeaveRoomResponse {
  success: boolean;
  message: string;
  roomClosed?: boolean;
}

// API functions
// Health check endpoint
export async function getHealthCheck(): Promise<HealthCheckResponse> {
  const response = await axiosInstance.get(endpoints.health);
  return response.data;
}

// Get room list endpoint
export async function getRoomList(): Promise<RoomListResponse> {
  const response = await axiosInstance.get(endpoints.listRooms);
  return response.data;
}

// Leave room endpoint
export async function leaveRoom(roomId: string, userId: string): Promise<LeaveRoomResponse> {
  const response = await axiosInstance.post(endpoints.leaveRoom(roomId), { userId });
  return response.data;
}