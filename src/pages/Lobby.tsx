import { useLobby } from '../hooks/useLobby';
import { Modal } from '../components/shared/Modal';

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
    showRejectionModal,
    rejectionMessage,
    isConnected,
    isConnecting,
    
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
    
    // Setters
    setTempUsername,
    setNewRoomName,
  } = useLobby();

  return (
    <div className="min-h-dvh bg-base-200 p-3">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-primary">collab</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success' : isConnecting ? 'bg-warning' : 'bg-error'}`}></div>
              {/* <span className="text-sm">
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span> */}
            </div>
            <button
              onClick={handleUsernameClick}
              className="badge badge-primary cursor-pointer hover:badge-secondary transition-colors"
              title="Click to change username"
            >
              {username}
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="card bg-base-100 shadow-xl h-full">
          <div className="card-body h-full">
            <div className="flex justify-between items-center">
              <h2 className="card-title">Available Rooms</h2>
              <div className="flex gap-2">
                <button
                  onClick={fetchRooms}
                  className="btn btn-sm btn-outline"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={handleCreateRoomButtonClick}
                  className="btn btn-sm btn-primary"
                >
                  Create
                </button>
              </div>
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
                  {rooms.map((room) => (
                    <div key={room.id} className="card bg-base-200">
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{room.name}</h3>
                            <p className="text-sm text-base-content/70">
                              {room.userCount} member{room.userCount !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-base-content/50">
                              Created {new Date(room.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <button
                              onClick={() => handleJoinRoom(room.id, 'band_member')}
                              className="btn btn-sm btn-primary"
                            >
                              Join as Band Member
                            </button>
                            <button
                              onClick={() => handleJoinRoom(room.id, 'audience')}
                              className="btn btn-sm btn-outline"
                            >
                              Join as Audience
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

        {/* Username Modal */}
        <Modal
          open={showUsernameModal}
          setOpen={handleUsernameModalClose}
          title={username ? "Change Username" : "Welcome to Jam Band!"}
          onCancel={handleUsernameModalClose}
          onOk={handleUsernameSubmit}
          okText={username ? "Update" : "Continue"}
          cancelText="Cancel"
          showOkButton={!!tempUsername.trim()}
        >
          <div className="space-y-4">
            {!username && (
              <p className="text-base-content/70">
                Please enter your username to continue
              </p>
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
                  if (e.key === 'Enter' && tempUsername.trim()) {
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
        >
          <form onSubmit={(e) => { e.preventDefault(); }}>
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
  );
} 