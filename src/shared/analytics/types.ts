import type { RoomType } from "@/shared/types";

export interface DeviceInfo {
  os?: string;
  browser?: string;
  category?: "mobile" | "tablet" | "desktop";
}

export interface NetworkStats {
  latencyMs?: number;
  jitterMs?: number;
  packetLossPct?: number;
}

export interface TrackOptions {
  roomId?: string;
  roomType?: RoomType | "lobby";
  projectId?: string;
  sessionId?: string;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
  device?: DeviceInfo;
  network?: NetworkStats;
}

export interface AnalyticsEventPayload {
  eventName: string;
  userId: string;
  sessionId: string;
  roomId?: string;
  roomType?: string;
  projectId?: string;
  occurredAt: Date;
  payload?: Record<string, unknown>;
  device?: DeviceInfo;
  network?: NetworkStats;
}
