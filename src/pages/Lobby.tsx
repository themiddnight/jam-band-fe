import { PingDisplay, usePingMeasurement } from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useLobby, InviteUrlInput } from "@/features/rooms";
import { Footer, TechnicalInfoPanel } from "@/features/ui";
import { Announcement } from "@/features/lobby/components/Announcement";
import {
  KickedModal,
  WaitingApprovalModal,
  UsernameModal,
  CreateRoomModal,
  RejectionModal,
} from "@/features/lobby/components/modals";
import { RoomItem } from "@/features/lobby/components/rooms";
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
    handleUsernameClick,
    handleCreateRoomModalClose,
    handleUsernameModalClose,
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

  // Ping measurement for lobby
  const { currentPing } = usePingMeasurement({
    socket: activeSocket,
    enabled: isConnected,
  });

  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <div className="flex-1 p-3">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-primary">collab</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    connectionState === ConnectionState.LOBBY
                      ? "bg-success"
                      : isConnecting
                        ? "bg-warning"
                        : "bg-error"
                  }`}
                ></div>
                <PingDisplay
                  ping={currentPing}
                  isConnected={isConnected}
                  variant="compact"
                  showLabel={false}
                />
              </div>
              <button
                onClick={handleUsernameClick}
                className="badge badge-primary cursor-pointer hover:badge-secondary transition-colors"
                title="Click to change username"
              >
                {username} ✎
              </button>
            </div>
          </div>

          {/* Kicked info modal */}
          <KickedModal
            open={showKickedModal}
            onClose={() => setShowKickedModal(false)}
            reason={kickedReason}
          />

          {/* Waiting for approval modal */}
          <WaitingApprovalModal
            open={connectionState === ConnectionState.REQUESTING}
            onCancel={cancelApproval}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
            {/* Available Rooms Card */}
            <div className="card bg-base-100 shadow-xl mb-4 h-full">
              <div className="card-body">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="card-title">Available Rooms</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchRooms()}
                      className="btn btn-sm btn-outline"
                      disabled={loading}
                    >
                      {loading ? "Loading..." : "Refresh"}
                    </button>
                    <button
                      onClick={handleCreateRoomButtonClick}
                      className="btn btn-sm btn-primary"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="form-control mb-3">
                  <label className="input input-bordered flex items-center gap-2 w-full">
                    <svg
                      className="h-[1em] opacity-50"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <g
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.3-4.3"></path>
                      </g>
                    </svg>
                    <input
                      type="search"
                      className="grow"
                      placeholder="Search rooms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </label>
                </div>

                {/* Room List */}
                <div className="flex flex-col gap-4">
                  {rooms.length === 0 ? (
                    <div className="text-center py-8 text-base-content/50">
                      <p>No rooms available</p>
                      <p className="text-sm">Create a room to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rooms.map((room: any) => (
                        <RoomItem
                          key={room.id}
                          room={room}
                          onJoinRoom={handleJoinRoom}
                          isConnecting={isConnecting}
                          connectionState={connectionState}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Invite URL Input */}
              <InviteUrlInput />

              {/* Announcement Card */}
              <Announcement
                emoji="🎉"
                title="New Feature Available!"
                highlight="Arrange Room"
                message="is now available! Create multi-track arrangements with asynchronous editing and collaborate on complex compositions."
              />

              {/* Technical Information Panel */}
              <TechnicalInfoPanel />
            </div>
          </div>

          {/* Username Modal */}
          <UsernameModal
            open={showUsernameModal}
            onClose={handleUsernameModalClose}
            onSubmit={handleUsernameSubmit}
            username={username}
            tempUsername={tempUsername}
            onTempUsernameChange={setTempUsername}
          />

          {/* Create Room Modal */}
          <CreateRoomModal
            open={showCreateRoomModal}
            onClose={handleCreateRoomModalClose}
            onSubmit={handleCreateRoomSubmit}
            roomName={newRoomName}
            roomDescription={newRoomDescription}
            roomType={newRoomType}
            isPrivate={isPrivate}
            isHidden={isHidden}
            onRoomNameChange={setNewRoomName}
            onRoomDescriptionChange={setNewRoomDescription}
            onRoomTypeChange={setNewRoomType}
            onIsPrivateChange={setIsPrivate}
            onIsHiddenChange={setIsHidden}
          />

          {/* Rejection Modal */}
          <RejectionModal
            open={showRejectionModal}
            onClose={handleRejectionModalClose}
            message={rejectionMessage}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
