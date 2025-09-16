import { PingDisplay, usePingMeasurement } from "@/features/audio";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useLobby, InviteUrlInput } from "@/features/rooms";
import { Modal, Footer, TechnicalInfoPanel } from "@/features/ui";
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
    const state = location.state as { kicked?: boolean; reason?: string } | null;
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
                  className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.LOBBY
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
          <Modal
            open={showKickedModal}
            setOpen={setShowKickedModal}
            title="Removed from Room"
            showCancelButton={false}
            okText="OK"
            onOk={() => setShowKickedModal(false)}
            allowClose={true}
            size="md"
          >
            <p className="text-base-content/70">{kickedReason}</p>
          </Modal>

          {/* Waiting for approval modal */}
          <Modal
            open={connectionState === ConnectionState.REQUESTING}
            setOpen={() => { }}
            title="Waiting for Approval"
            showOkButton={false}
            showCancelButton={true}
            cancelText="Cancel Request"
            onCancel={cancelApproval}
            allowClose={false}
            size="md"
          >
            <div className="space-y-4">
              <p className="text-base-content/70">
                Your request to join the private room as a band member is
                pending owner approval.
              </p>
              <div className="flex justify-center">
                <div className="loading loading-spinner mx-auto loading-lg text-primary"></div>
              </div>
            </div>
          </Modal>

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
                        <div key={room.id} className="card bg-base-200">
                          <div className="card-body p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{room.name}</h3>
                                  <span className={`badge badge-sm ${room.roomType === "perform" ? "badge-primary" : "badge-secondary"}`}>
                                    {room.roomType === "perform" ? "Perform" : "Produce"}
                                  </span>
                                  {room.isPrivate && (
                                    <span className="badge badge-warning badge-sm">
                                      Private
                                    </span>
                                  )}
                                  {room.isHidden && (
                                    <span className="badge badge-neutral badge-sm">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                {room.description && (
                                  <p className="text-sm text-base-content/80 mt-1">
                                    {room.description}
                                  </p>
                                )}
                                <p className="text-xs text-base-content/70 mt-1">
                                  {room.userCount} member
                                  {room.userCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span className="text-xs text-base-content/70">
                                  Join as:
                                </span>
                                <button
                                  onClick={() =>
                                    handleJoinRoom(room.id, "band_member")
                                  }
                                  className="btn btn-xs btn-primary"
                                  disabled={
                                    isConnecting ||
                                    connectionState === ConnectionState.REQUESTING
                                  }
                                >
                                  Band Member
                                </button>
                                <button
                                  onClick={() =>
                                    handleJoinRoom(room.id, "audience")
                                  }
                                  className="btn btn-xs btn-outline"
                                  disabled={
                                    isConnecting ||
                                    connectionState === ConnectionState.REQUESTING
                                  }
                                >
                                  Audience
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Invite URL Input */}
              <InviteUrlInput />

              {/* Technical Information Panel */}
              <TechnicalInfoPanel />
            </div>
          </div>

          {/* Username Modal */}
          <Modal
            open={showUsernameModal}
            setOpen={handleUsernameModalClose}
            title={username ? "Change Username" : "Welcome to COLLAB!"}
            onCancel={handleUsernameModalClose}
            onOk={handleUsernameSubmit}
            okText={username ? "Update" : "Continue"}
            cancelText="Cancel"
            showOkButton={!!tempUsername.trim()}
            showCancelButton={!!username}
            allowClose={!!username || !!tempUsername.trim()}
          >
            <div className="space-y-4">
              {!username && (
                <>
                  <p className="text-base-content/70 mb-0">
                    Please enter your username to continue
                  </p>
                  <p className="text-base-content/30 text-xs">
                    We don't store your username—it's only saved in your
                    browser.
                  </p>
                </>
              )}
              <div className="form-control">
                <label className="label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  className="input input-bordered w-full"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  autoFocus
                  required
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tempUsername.trim()) {
                      handleUsernameSubmit();
                    }
                  }}
                />
              </div>
            </div>
          </Modal>

          {/* Create Room Modal */}
          <Modal
            open={showCreateRoomModal}
            setOpen={handleCreateRoomModalClose}
            title="Create New Room"
            onCancel={handleCreateRoomModalClose}
            onOk={handleCreateRoomSubmit}
            okText="Create Room"
            cancelText="Cancel"
            showOkButton={!!newRoomName.trim()}
            size="xl"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label" htmlFor="newRoomName">
                    Room Name
                  </label>
                  <input
                    id="newRoomName"
                    type="text"
                    placeholder="Enter room name"
                    className="input input-bordered w-full"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="newRoomDescription">
                    Description (Optional)
                  </label>
                  <textarea
                    id="newRoomDescription"
                    placeholder="Describe your room..."
                    className="textarea textarea-bordered w-full"
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    Room Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      className={`card cursor-pointer transition-all ${newRoomType === "perform" ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300"}`}
                      onClick={() => setNewRoomType("perform")}
                    >
                      <div className="card-body p-4">
                        <h4 className="card-title text-sm">Perform Room</h4>
                        <p className="text-xs opacity-70">
                          Real-time jamming with instruments and voice chat
                        </p>
                      </div>
                    </div>
                    <div 
                      className={`card cursor-not-allowed opacity-50 ${newRoomType === "produce" ? "bg-primary text-primary-content" : "bg-base-200"}`}
                      title="Coming soon!"
                    >
                      <div className="card-body p-4">
                        <h4 className="card-title text-sm">Produce Room</h4>
                        <p className="text-xs opacity-70">
                          Multi-track production with async editing (Coming Soon)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    <div className="flex flex-col">
                      <span className="label-text select-none">
                        Private Room
                      </span>
                      <p className="text-sm text-base-content/50">
                        Band members need approval to join
                      </p>
                    </div>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={isHidden}
                      onChange={(e) => setIsHidden(e.target.checked)}
                    />
                    <div className="flex flex-col">
                      <span className="label-text select-none">
                        Hidden Room
                      </span>
                      <p className="text-sm text-base-content/50">
                        Room won't appear in the public list
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          </Modal>

          {/* Rejection Modal */}
          <Modal
            open={showRejectionModal}
            setOpen={handleRejectionModalClose}
            title="Request Rejected"
            onOk={handleRejectionModalClose}
            okText="Return to Lobby"
            showCancelButton={false}
          >
            <p className="text-base-content/70">{rejectionMessage}</p>
          </Modal>
        </div>
      </div>
      <Footer />
    </div>
  );
}
