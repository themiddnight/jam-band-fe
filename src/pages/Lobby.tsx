import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useRoomStore } from '../stores/roomStore';
import { useSocket } from '../hooks/useSocket';
import { Modal } from '../components/shared/Modal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface Room {
  id: string;
  name: string;
  userCount: number;
  owner: string;
  createdAt: string;
}

export default function Lobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, setUsername } = useUserStore();
  const { connect, createRoom, isConnected, isConnecting, onRoomCreated, onRoomClosed } = useSocket();
  const { currentRoom } = useRoomStore();

  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string>('');

  // Check if username is set
  useEffect(() => {
    if (!username) {
      setShowUsernameModal(true);
    }
  }, [username]);

  // Check for rejection message in location state
  useEffect(() => {
    const state = location.state as { rejectionMessage?: string } | null;
    if (state?.rejectionMessage) {
      setRejectionMessage(state.rejectionMessage);
      setShowRejectionModal(true);
      // Clear the state to prevent showing the modal again on refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // Connect to socket and fetch rooms
  useEffect(() => {
    if (username && !isConnected && !isConnecting) {
      connect();
    }
  }, [username, connect, isConnected, isConnecting]);

  // Fetch rooms when socket connects
  useEffect(() => {
    if (isConnected) {
      fetchRooms();
    }
  }, [isConnected]);

  // Periodic room list refresh
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(fetchRooms, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Listen for room creation and deletion broadcasts
  useEffect(() => {
    if (!isConnected) return;

    const handleRoomCreated = () => {
      // Refresh the room list immediately when a new room is created
      fetchRooms();
    };

    const handleRoomClosed = (roomId: string) => {
      setRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
    };

    // Set up the room created and closed callbacks
    onRoomCreated(handleRoomCreated);
    onRoomClosed(handleRoomClosed);
  }, [isConnected, onRoomCreated, onRoomClosed]);

  // Redirect to room when created
  useEffect(() => {
    if (currentRoom) {
      navigate(`/room/${currentRoom.id}`);
    }
  }, [currentRoom, navigate]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/rooms`);
      const data = await response.json();
      setRooms(data);
    } catch {
      // Failed to fetch rooms
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = () => {
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
      setShowUsernameModal(false);
      setTempUsername('');
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() && username) {
      createRoom(newRoomName.trim(), username);
      setShowCreateRoomModal(false);
      setNewRoomName('');
    }
  };

  const handleJoinRoom = (roomId: string, role: 'band_member' | 'audience') => {
    if (username) {
      navigate(`/room/${roomId}`, { state: { role } });
    }
  };

  const handleUsernameClick = () => {
    setTempUsername(username || '');
    setShowUsernameModal(true);
  };

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
                  onClick={() => setShowCreateRoomModal(true)}
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
          setOpen={setShowUsernameModal}
          title={username ? "Change Username" : "Welcome to Jam Band!"}
          onCancel={() => {
            setShowUsernameModal(false);
            setTempUsername('');
          }}
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
          setOpen={setShowCreateRoomModal}
          title="Create New Room"
          onCancel={() => {
            setShowCreateRoomModal(false);
            setNewRoomName('');
          }}
          onOk={() => {
            if (newRoomName.trim()) {
              handleCreateRoom({ preventDefault: () => {} } as React.FormEvent);
            }
          }}
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
          setOpen={setShowRejectionModal}
          title="Request Rejected"
          onOk={() => {
            setShowRejectionModal(false);
            setRejectionMessage('');
          }}
          okText="OK"
          showCancelButton={false}
        >
          <p className="text-base-content/70">{rejectionMessage}</p>
        </Modal>
      </div>
    </div>
  );
} 