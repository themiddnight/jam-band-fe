import { useLobby } from "@/features/rooms";
import { Footer } from "@/features/ui";
import { LobbyHeader } from "@/features/lobby/components/LobbyHeader";
import { AvailableRoomsSection } from "@/features/lobby/components/AvailableRoomsSection";
import { LobbySidebar } from "@/features/lobby/components/LobbySidebar";
import { LobbyModals } from "@/features/lobby/components/LobbyModals";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Lobby page using the RoomSocketManager for namespace-based connections
 */
export default function Lobby() {
  const {
    // State
    username,
    rooms,
    loading,
    showUsernameModal,
    showAuthChoiceModal,
    tempUsername,
    showCreateRoomModal,
    newRoomName,
    newRoomDescription,
    newRoomType,
    showRejectionModal,
    rejectionMessage,
    isConnected,
    isConnecting,
    isPrivate,
    isHidden,
    connectionState,

    // Actions
    fetchRooms,
    handleUsernameSubmit,
    handleJoinRoom,
    handleCreateRoomModalClose,
    handleUsernameModalClose,
    handleGuestEnter,
    handleRejectionModalClose,
    handleCreateRoomSubmit,
    handleCreateRoomButtonClick,
    cancelApproval,

    // Setters
    setTempUsername,
    setNewRoomName,
    setNewRoomDescription,
    setNewRoomType,
    setIsPrivate,
    setIsHidden,
    setSearchQuery,

    // Search
    searchQuery,

    // Socket for ping measurement
    activeSocket,
  } = useLobby();

  const location = useLocation();
  const navigate = useNavigate();
  const [showKickedModal, setShowKickedModal] = useState(false);
  const [kickedReason, setKickedReason] = useState<string | undefined>();
  const [showAuthChoiceModalFromButton, setShowAuthChoiceModalFromButton] = useState(false);

  useEffect(() => {
    const state = location.state as {
      kicked?: boolean;
      reason?: string;
    } | null;
    if (state?.kicked) {
      setKickedReason(state.reason ?? "You have been removed from the room.");
      setShowKickedModal(true);
      // Clear the state so refresh/back doesn't retrigger
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  const handleGuestButtonClick = () => {
    setShowAuthChoiceModalFromButton(true);
  };

  return (
    <div className="min-h-dvh xl:h-dvh xl:overflow-hidden bg-base-200 flex flex-col">
      <div className="flex-1 p-3 flex flex-col min-h-0">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex-none">
            <LobbyHeader
              connectionState={connectionState}
              isConnecting={isConnecting}
              isConnected={isConnected}
              activeSocket={activeSocket}
              onGuestButtonClick={handleGuestButtonClick}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0 mt-4">
            {/* Available Rooms Section */}
            <AvailableRoomsSection
              rooms={rooms}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={fetchRooms}
              onCreateRoom={handleCreateRoomButtonClick}
              onJoinRoom={handleJoinRoom}
              isConnecting={isConnecting}
              connectionState={connectionState}
            />

            {/* Sidebar */}
            <LobbySidebar />
          </div>

          {/* All Modals */}
          <LobbyModals
            showKickedModal={showKickedModal}
            kickedReason={kickedReason}
            onCloseKickedModal={() => setShowKickedModal(false)}
            connectionState={connectionState}
            onCancelApproval={cancelApproval}
            showAuthChoiceModal={showAuthChoiceModal || showAuthChoiceModalFromButton}
            onGuestEnter={() => {
              handleGuestEnter();
              setShowAuthChoiceModalFromButton(false);
            }}
            onAuthChoiceModalClose={() => setShowAuthChoiceModalFromButton(false)}
            showUsernameModal={showUsernameModal}
            username={username}
            tempUsername={tempUsername}
            onUsernameSubmit={handleUsernameSubmit}
            onUsernameModalClose={handleUsernameModalClose}
            onTempUsernameChange={setTempUsername}
            showCreateRoomModal={showCreateRoomModal}
            newRoomName={newRoomName}
            newRoomDescription={newRoomDescription}
            newRoomType={newRoomType}
            isPrivate={isPrivate}
            isHidden={isHidden}
            onCreateRoomModalClose={handleCreateRoomModalClose}
            onCreateRoomSubmit={handleCreateRoomSubmit}
            onRoomNameChange={setNewRoomName}
            onRoomDescriptionChange={setNewRoomDescription}
            onRoomTypeChange={setNewRoomType}
            onIsPrivateChange={setIsPrivate}
            onIsHiddenChange={setIsHidden}
            showRejectionModal={showRejectionModal}
            rejectionMessage={rejectionMessage}
            onRejectionModalClose={handleRejectionModalClose}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
