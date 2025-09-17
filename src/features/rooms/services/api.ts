import axiosInstance from "../../../shared/utils/axiosInstance";
import { endpoints } from "../../../shared/utils/endpoints";

// Types for API responses
export interface Room {
  id: string;
  name: string;
  description?: string;
  roomType: "perform" | "produce";
  owner: string;
  isPrivate: boolean;
  isHidden: boolean;
  createdAt: string;
  userCount: number;
}

export interface User {
  id: string;
  username: string;
  role: "room_owner" | "band_member" | "audience";
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

// Create room endpoint
export async function createRoom(
  name: string,
  username: string,
  userId: string,
  isPrivate: boolean = false,
  isHidden: boolean = false,
  description?: string,
  roomType: "perform" | "produce" = "perform",
): Promise<{ success: boolean; room: Room; user: User }> {
  const response = await axiosInstance.post(endpoints.createRoom, {
    name,
    username,
    userId,
    isPrivate,
    isHidden,
    description,
    roomType,
  });
  return response.data;
}

// Leave room endpoint
export async function leaveRoom(
  roomId: string,
  userId: string,
): Promise<LeaveRoomResponse> {
  const response = await axiosInstance.post(endpoints.leaveRoom(roomId), {
    userId,
  });
  return response.data;
}

// Update room settings endpoint
export interface UpdateRoomSettingsRequest {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  isHidden?: boolean;
  updatedBy: string;
}

export interface UpdateRoomSettingsResponse {
  success: boolean;
  message: string;
  room: Room & {
    users: any[];
    pendingMembers: any[];
  };
}

export async function updateRoomSettings(
  roomId: string,
  settings: UpdateRoomSettingsRequest,
): Promise<UpdateRoomSettingsResponse> {
  const response = await axiosInstance.put(`/api/rooms/${roomId}/settings`, settings);
  return response.data;
}
