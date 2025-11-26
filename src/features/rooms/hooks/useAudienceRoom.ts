import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { useUserStore } from "@/shared/stores/userStore";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useRoomStore } from "@/features/rooms";

interface UseAudienceRoomOptions {
  roomId: string;
}

interface RoomUser {
  id: string;
  username: string;
  role: "room_owner" | "band_member" | "audience";
  currentInstrument?: string;
  currentCategory?: string;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  users: RoomUser[];
  pendingMembers: RoomUser[];
  isBroadcasting?: boolean;
}

export function useAudienceRoom({ roomId }: UseAudienceRoomOptions) {
  const navigate = useNavigate();
  const { username, userId } = useUserStore();
  const { currentRoom, currentUser } = useRoomStore();
  
  const {
    connectionState,
    isConnecting,
    error,
    connectToRoom,
    disconnect,
    getActiveSocket,
  } = useRoomSocket();

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  const isConnected = connectionState === ConnectionState.IN_ROOM;

  // Initialize connection
  useEffect(() => {
    if (!roomId || !username || !userId) {
      navigate("/");
      return;
    }

    // Connect to room as audience
    connectToRoom(roomId, "audience");
  }, [roomId, username, userId, navigate, connectToRoom]);

  // Set up broadcast state listeners
  useEffect(() => {
    const socket = getActiveSocket();
    if (!socket) return;

    const handleBroadcastStateChanged = (data: { isBroadcasting: boolean; playlistUrl?: string | null }) => {
      console.log("📡 Broadcast state changed:", data);
      setIsBroadcasting(data.isBroadcasting);
      setPlaylistUrl(data.playlistUrl ?? null);
    };

    const handleBroadcastState = (data: { isBroadcasting: boolean; playlistUrl?: string | null }) => {
      console.log("📡 Broadcast state:", data);
      setIsBroadcasting(data.isBroadcasting);
      setPlaylistUrl(data.playlistUrl ?? null);
    };

    socket.on("broadcast_state_changed", handleBroadcastStateChanged);
    socket.on("broadcast_state", handleBroadcastState);

    // Request current broadcast state
    socket.emit("perform:request_broadcast_state");

    return () => {
      socket.off("broadcast_state_changed", handleBroadcastStateChanged);
      socket.off("broadcast_state", handleBroadcastState);
    };
  }, [getActiveSocket, connectionState]);

  // Update isBroadcasting from room state
  useEffect(() => {
    if (currentRoom) {
      setIsBroadcasting((currentRoom as Room).isBroadcasting ?? false);
    }
  }, [currentRoom]);

  // Send chat message
  const sendChatMessage = useCallback((message: string) => {
    const socket = getActiveSocket();
    if (socket && message.trim() && roomId) {
      socket.emit("chat_message", { 
        message: message.trim(),
        roomId: roomId 
      });
    }
  }, [getActiveSocket, roomId]);

  // Handle leave room
  const handleLeaveRoom = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    currentRoom: currentRoom as Room | null,
    currentUser: currentUser as RoomUser | null,
    isConnected,
    isConnecting,
    error,
    isBroadcasting,
    playlistUrl,
    connectionState,
    sendChatMessage,
    handleLeaveRoom,
  };
}
