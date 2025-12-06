import { useCallback } from "react";
import { useRoomStore } from "@/features/rooms";
import { updateRoomSettings as apiUpdateRoomSettings } from "@/features/rooms/services/api";
import type { UpdateRoomSettingsRequest } from "@/features/rooms/services/api";
import { ConnectionState } from "@/features/audio/types/connectionState";

interface UseRoomActionsProps {
  connectionState: ConnectionState;
  userId: string | null;
  cancelApprovalRequest: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  approveMember: (userId: string) => void;
  rejectMember: (userId: string) => void;
  sendChatMessage: (message: string, roomId: string) => void;
  setShowLeaveConfirmModal: (show: boolean) => void;
}

export const useRoomActions = ({
  connectionState,
  userId,
  cancelApprovalRequest,
  leaveRoom,
  approveMember,
  rejectMember,
  sendChatMessage,
  setShowLeaveConfirmModal,
}: UseRoomActionsProps) => {
  const { currentRoom, currentUser, clearRoom } = useRoomStore();

  // Room management handlers
  const handleApproveMember = useCallback(
    (targetUserId: string) => {
      approveMember(targetUserId);
    },
    [approveMember],
  );

  const handleRejectMember = useCallback(
    (targetUserId: string) => {
      rejectMember(targetUserId);
    },
    [rejectMember],
  );

  // Leave room handlers
  const handleLeaveRoomClick = useCallback(() => {
    setShowLeaveConfirmModal(true);
  }, [setShowLeaveConfirmModal]);

  const handleLeaveRoomConfirm = useCallback(async () => {
    setShowLeaveConfirmModal(false);

    if (connectionState === ConnectionState.REQUESTING) {
      // If we're in approval state, cancel the request
      await cancelApprovalRequest();
    } else {
      // Otherwise, leave the room
      await leaveRoom();
    }

    // Clear room state and navigate to lobby
    clearRoom();
    window.location.href = "/";
  }, [connectionState, cancelApprovalRequest, leaveRoom, clearRoom, setShowLeaveConfirmModal]);

  const handleLeaveRoom = useCallback(async () => {
    if (connectionState === ConnectionState.REQUESTING) {
      await cancelApprovalRequest();
    } else {
      await leaveRoom();
    }
    clearRoom();
    window.location.href = "/";
  }, [connectionState, cancelApprovalRequest, leaveRoom, clearRoom]);

  // Room settings handler
  const handleUpdateRoomSettings = useCallback(
    async (settings: {
      name?: string;
      description?: string;
      isPrivate?: boolean;
      isHidden?: boolean;
    }) => {
      if (!currentRoom?.id || !userId) {
        throw new Error("Room ID or user ID not available");
      }

      if (currentUser?.role !== "room_owner") {
        throw new Error("Only room owner can update settings");
      }

      const updateRequest: UpdateRoomSettingsRequest = {
        ...settings,
        updatedBy: userId,
      };

      try {
        const response = await apiUpdateRoomSettings(
          currentRoom.id,
          updateRequest,
        );

        // The room state will be updated via socket events from the server
        // No need to manually update the store here

        return response;
      } catch (error) {
        console.error("Failed to update room settings:", error);
        throw error;
      }
    },
    [currentRoom?.id, userId, currentUser?.role],
  );

  const handleSendChatMessage = useCallback(
    (message: string) => {
      if (!currentRoom?.id) return;
      sendChatMessage(message, currentRoom.id);
    },
    [currentRoom?.id, sendChatMessage],
  );

  return {
    handleApproveMember,
    handleRejectMember,
    handleLeaveRoomClick,
    handleLeaveRoomConfirm,
    handleLeaveRoom,
    handleUpdateRoomSettings,
    handleSendChatMessage,
  };
};
