// Rooms Feature Barrel Export

// Room Type Architecture exports
export { RoomFactory } from "./core/services/RoomFactory";
export { ROOM_TYPES } from "./core/types/RoomType";
export type { RoomType, RoomTypeConfig, RoomInstance, RoomServices, RoomState } from "./core/types/RoomType";

// Components exports
export { default as ChatBox } from "./components/ChatBox";
export { default as RoomMembers } from "./components/RoomMembers";
export { default as ArrangeRoomMembers } from "./components/ArrangeRoomMembers";
export { default as RoomItem } from "./components/RoomItem";
export { default as PlayingIndicator } from "./components/PlayingIndicator";
export { default as UserActionsMenu } from "./components/UserActionsMenu";
export { default as SwapInstrumentModal } from "./components/SwapInstrumentModal";
export { default as KickUserModal } from "./components/KickUserModal";
export { default as PendingSwapStatus } from "./components/PendingSwapStatus";
export { default as RoomSettingsModal } from "./components/RoomSettingsModal";
export { ApprovalWaiting } from "./components/ApprovalWaiting";
export { InviteUrlInput } from "./components/InviteUrlInput";

// Hooks exports
export { useRoom } from "./hooks/useRoom";
export { useLobby } from "./hooks/useLobby";
export { useInviteUrl } from "./hooks/useInviteUrl";
export { useAudienceRoom } from "./hooks/useAudienceRoom";
export { useBroadcastStream } from "./hooks/useBroadcastStream";

// Services exports
export { useRoomQuery, roomKeys } from "./services/useRooms";
export * from "./services/api";

// Store exports
export { useRoomStore } from "./stores/roomStore";

// Constants exports
export * from "./constants/chat";
