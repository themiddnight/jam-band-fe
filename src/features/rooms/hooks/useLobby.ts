import { useSocket } from "@/features/audio/hooks/useSocket";
import { useRoomQuery, useRoomStore } from "@/features/rooms";
import { useUserStore } from "@/shared/stores/userStore";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function useLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, userId, setUsername } = useUserStore();
  const {
    connect,
    createRoom,
    isConnected,
    isConnecting,
    onRoomCreated,
    onRoomClosed,
  } = useSocket();
  const { currentRoom } = useRoomStore();

  // Use TanStack Query for room fetching
  const { roomsQuery } = useRoomQuery();
  const { data: rooms, isLoading: loading, refetch: fetchRooms } = roomsQuery;

  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string>("");

  // Check if username is set
  useEffect(() => {
    if (!username) {
      setShowUsernameModal(true);
    } else {
      // Check if there's a pending invite in sessionStorage (for when user refreshes after setting username)
      const pendingInvite = sessionStorage.getItem("pendingInvite");
      if (pendingInvite) {
        try {
          const { roomId, role } = JSON.parse(pendingInvite);
          sessionStorage.removeItem("pendingInvite");
          navigate(`/room/${roomId}`, { state: { role } });
        } catch (error) {
          console.error("Failed to parse pending invite:", error);
          sessionStorage.removeItem("pendingInvite");
        }
      }
    }
  }, [username, navigate]);

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

  // Listen for room creation and deletion broadcasts
  useEffect(() => {
    if (!isConnected) return;

    const handleRoomCreated = () => {
      // Refresh the room list immediately when a new room is created
      fetchRooms();
    };

    const handleRoomClosed = () => {
      // Refresh the room list when a room is closed
      fetchRooms();
    };

    // Set up the room created and closed callbacks
    onRoomCreated(handleRoomCreated);
    onRoomClosed(handleRoomClosed);
  }, [isConnected, onRoomCreated, onRoomClosed, fetchRooms]);

  // Redirect to room when created
  useEffect(() => {
    if (currentRoom) {
      navigate(`/room/${currentRoom.id}`);
    }
  }, [currentRoom, navigate]);

  const handleUsernameSubmit = () => {
    if (tempUsername.trim()) {
      setUsername(tempUsername.trim());
      setShowUsernameModal(false);
      setTempUsername("");
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() && username && userId) {
      createRoom(newRoomName.trim(), username, userId, isPrivate, isHidden);
      setShowCreateRoomModal(false);
      setNewRoomName("");
      setIsPrivate(false);
      setIsHidden(false);
    }
  };

  const handleJoinRoom = (roomId: string, role: "band_member" | "audience") => {
    if (username && userId) {
      navigate(`/room/${roomId}`, { state: { role } });
    }
  };

  const handleUsernameClick = () => {
    setTempUsername(username || "");
    setShowUsernameModal(true);
  };

  const handleCreateRoomModalClose = () => {
    setShowCreateRoomModal(false);
    setNewRoomName("");
    setIsPrivate(false);
    setIsHidden(false);
  };

  const handleUsernameModalClose = () => {
    setShowUsernameModal(false);
    setTempUsername("");
  };

  const handleRejectionModalClose = () => {
    setShowRejectionModal(false);
    setRejectionMessage("");
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
    rooms: rooms || [],
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
