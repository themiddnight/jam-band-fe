import { useUserStore } from "@/shared/stores/userStore";
import { ConnectionState } from "@/features/audio/types/connectionState";
import {
  KickedModal,
  WaitingApprovalModal,
  UsernameModal,
  AuthChoiceModal,
  CreateRoomModal,
  RejectionModal,
} from "./modals";

interface LobbyModalsProps {
  showKickedModal: boolean;
  kickedReason?: string;
  onCloseKickedModal: () => void;
  connectionState: ConnectionState;
  onCancelApproval: () => void;
  showAuthChoiceModal: boolean;
  onGuestEnter: () => void;
  onAuthChoiceModalClose?: () => void;
  showUsernameModal: boolean;
  username: string | null;
  tempUsername: string;
  onUsernameSubmit: () => void;
  onUsernameModalClose: () => void;
  onTempUsernameChange: (value: string) => void;
  showCreateRoomModal: boolean;
  newRoomName: string;
  newRoomDescription: string;
  newRoomType: "perform" | "arrange";
  isPrivate: boolean;
  isHidden: boolean;
  onCreateRoomModalClose: () => void;
  onCreateRoomSubmit: () => void;
  onRoomNameChange: (value: string) => void;
  onRoomDescriptionChange: (value: string) => void;
  onRoomTypeChange: (value: "perform" | "arrange") => void;
  onIsPrivateChange: (value: boolean) => void;
  onIsHiddenChange: (value: boolean) => void;
  showRejectionModal: boolean;
  rejectionMessage: string;
  onRejectionModalClose: () => void;
}

export function LobbyModals({
  showKickedModal,
  kickedReason,
  onCloseKickedModal,
  connectionState,
  onCancelApproval,
  showAuthChoiceModal,
  onGuestEnter,
  onAuthChoiceModalClose,
  showUsernameModal,
  username,
  tempUsername,
  onUsernameSubmit,
  onUsernameModalClose,
  onTempUsernameChange,
  showCreateRoomModal,
  newRoomName,
  newRoomDescription,
  newRoomType,
  isPrivate,
  isHidden,
  onCreateRoomModalClose,
  onCreateRoomSubmit,
  onRoomNameChange,
  onRoomDescriptionChange,
  onRoomTypeChange,
  onIsPrivateChange,
  onIsHiddenChange,
  showRejectionModal,
  rejectionMessage,
  onRejectionModalClose,
}: LobbyModalsProps) {
  const { isAuthenticated } = useUserStore();

  return (
    <>
      {/* Kicked info modal */}
      <KickedModal
        open={showKickedModal}
        onClose={onCloseKickedModal}
        reason={kickedReason}
      />

      {/* Waiting for approval modal */}
      <WaitingApprovalModal
        open={connectionState === ConnectionState.REQUESTING}
        onCancel={onCancelApproval}
      />

      {/* Auth Choice Modal - shown when not authenticated or from guest button */}
      <AuthChoiceModal
        open={showAuthChoiceModal}
        onClose={onAuthChoiceModalClose || (() => {})} // Allow closing if from guest button
        onGuestEnter={onGuestEnter}
        allowClose={!!onAuthChoiceModalClose} // Allow closing if callback provided (from guest button)
      />

      {/* Username Modal - only for changing username when authenticated */}
      {isAuthenticated && (
        <UsernameModal
          open={showUsernameModal}
          onClose={onUsernameModalClose}
          onSubmit={onUsernameSubmit}
          username={username}
          tempUsername={tempUsername}
          onTempUsernameChange={onTempUsernameChange}
        />
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        open={showCreateRoomModal}
        onClose={onCreateRoomModalClose}
        onSubmit={onCreateRoomSubmit}
        roomName={newRoomName}
        roomDescription={newRoomDescription}
        roomType={newRoomType}
        isPrivate={isPrivate}
        isHidden={isHidden}
        onRoomNameChange={onRoomNameChange}
        onRoomDescriptionChange={onRoomDescriptionChange}
        onRoomTypeChange={onRoomTypeChange}
        onIsPrivateChange={onIsPrivateChange}
        onIsHiddenChange={onIsHiddenChange}
      />

      {/* Rejection Modal */}
      <RejectionModal
        open={showRejectionModal}
        onClose={onRejectionModalClose}
        message={rejectionMessage}
      />
    </>
  );
}

