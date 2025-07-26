import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useRoomStore } from '../stores/roomStore';
import { useSocket } from './useSocket';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface Room {
  id: string;
  name: string;
  userCount: number;
  owner: string;
  isPrivate: boolean;
  isHidden: boolean;
  createdAt: string;
}

export function useLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, userId, setUsername } = useUserStore();
  const { connect, createRoom, isConnected, isConnecting, onRoomCreated, onRoomClosed } = useSocket();
  const { currentRoom } = useRoomStore();

  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
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
    if (newRoomName.trim() && username && userId) {
      createRoom(newRoomName.trim(), username, userId, isPrivate, isHidden);
      setShowCreateRoomModal(false);
      setNewRoomName('');
      setIsPrivate(false);
      setIsHidden(false);
    }
  };

  const handleJoinRoom = (roomId: string, role: 'band_member' | 'audience') => {
    if (username && userId) {
      navigate(`/room/${roomId}`, { state: { role } });
    }
  };

  const handleUsernameClick = () => {
    setTempUsername(username || '');
    setShowUsernameModal(true);
  };

  const handleCreateRoomModalClose = () => {
    setShowCreateRoomModal(false);
    setNewRoomName('');
    setIsPrivate(false);
    setIsHidden(false);
  };

  const handleUsernameModalClose = () => {
    setShowUsernameModal(false);
    setTempUsername('');
  };

  const handleRejectionModalClose = () => {
    setShowRejectionModal(false);
    setRejectionMessage('');
  };

  const handleCreateRoomSubmit = () => {
    if (newRoomName.trim()) {
      handleCreateRoom({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  const handleCreateRoomButtonClick = () => {
    setShowCreateRoomModal(true);
  };

  return {
    // State
    username,
    rooms,
    loading,
    showUsernameModal,
    tempUsername,
    showCreateRoomModal,
    newRoomName,
    isPrivate,
    isHidden,
    showRejectionModal,
    rejectionMessage,
    isConnected,
    isConnecting,
    
    // Actions
    fetchRooms,
    handleUsernameSubmit,
    handleCreateRoom,
    handleJoinRoom,
    handleUsernameClick,
    handleCreateRoomModalClose,
    handleUsernameModalClose,
    handleRejectionModalClose,
    handleCreateRoomSubmit,
    handleCreateRoomButtonClick,
    
    // Setters
    setShowUsernameModal,
    setTempUsername,
    setShowCreateRoomModal,
    setNewRoomName,
    setIsPrivate,
    setIsHidden,
    setShowRejectionModal,
  };
} 