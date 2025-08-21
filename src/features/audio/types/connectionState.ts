/**
 * Connection states for the room isolation architecture
 */
export enum ConnectionState {
  LOBBY = "lobby", // Connected to /lobby-monitor only
  REQUESTING = "requesting", // Connected to /approval/{roomId}
  IN_ROOM = "in_room", // Connected to /room/{roomId}
  DISCONNECTED = "disconnected",
}

/**
 * Connection transition events
 */
export enum ConnectionEvent {
  ENTER_LOBBY = "enter_lobby",
  JOIN_PUBLIC_ROOM = "join_public_room",
  REQUEST_PRIVATE_ROOM = "request_private_room",
  APPROVAL_GRANTED = "approval_granted",
  APPROVAL_DENIED = "approval_denied",
  APPROVAL_TIMEOUT = "approval_timeout",
  LEAVE_ROOM = "leave_room",
  DISCONNECT = "disconnect",
  CANCEL_REQUEST = "cancel_request",
}

/**
 * Connection configuration for different states
 */
export interface ConnectionConfig {
  state: ConnectionState;
  namespace?: string;
  roomId?: string;
  role?: "band_member" | "audience";
}

/**
 * Approval request data
 */
export interface ApprovalRequest {
  roomId: string;
  userId: string;
  username: string;
  role: "band_member" | "audience";
  timestamp: number;
}
