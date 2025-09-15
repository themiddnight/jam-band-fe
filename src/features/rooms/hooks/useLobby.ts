import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useRoomQuery, useRoomStore } from "@/features/rooms";
import { createRoom as createRoomAPI } from "@/features/rooms/services/api";
import { useUserStore } from "@/shared/stores/userStore";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import type { Socket } from "socket.io-client";

/**
 * Lobby hook using the RoomSocketManager for namespace-based connections
 */
export const useLobby = () => {
  const navigate = useNavigate();

  // User state
  const { username, userId, setUsername, setUserId } = useUserStore();

  // Room socket
  const {
    connectionState,
    isConnecting,
    error,
    connectToLobby,
    connectToRoom,
    requestRoomApproval,
    cancelApprovalRequest,
    getActiveSocket,
    onRoomCreated,
    onRoomClosed,
  } = useRoomSocket();

  // Room store
  const { clearRoom } = useRoomStore();

  // Active socket state to trigger re-renders when it changes
  const [activeSocket, setActiveSocket] = useState<Socket | null>(
    getActiveSocket(),
  );

  // Keep active socket updated with the latest from the manager
  useEffect(() => {
    const next = getActiveSocket();
    // Only update when identity changes to avoid unnecessary renders
    if (next !== activeSocket) {
      // Socket changed, update reference
      setActiveSocket(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActiveSocket, connectionState]);

  // Temporarily disabled socket health check for debugging
  useEffect(() => {
    // Disabled to test if this is causing ping measurement issues
    
  }, [connectionState, activeSocket, getActiveSocket]);

  // Room query for HTTP-based room list
  const { roomsQuery } = useRoomQuery();
  const rooms = useMemo(() => roomsQuery.data || [], [roomsQuery.data]);
  const loading = roomsQuery.isLoading;
  const fetchRooms = roomsQuery.refetch;

  // UI state
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Track pending room intent while waiting for approval
  const [pendingRoomIntent, setPendingRoomIntent] = useState<{
    roomId: string;
    role: "band_member" | "audience";
  } | null>(null);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedSearchQuery(query);
      }, 300),
    []
  );

  // Update debounced search when search query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // Filter rooms based on search query
  const filteredRooms = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return rooms;
    }
    
    const query = debouncedSearchQuery.toLowerCase();
    return rooms.filter((room: any) => 
      room.name.toLowerCase().includes(query)
    );
  }, [rooms, debouncedSearchQuery]);

  // Define handleJoinRoom first
  const handleJoinRoom = useCallback(
    async (roomId: string, role: "band_member" | "audience") => {
      if (!username || !userId) {
        setShowUsernameModal(true);
        return;
      }

      // Clear any existing room state
      clearRoom();

      // Find the room to check if it's private (use filteredRooms for consistency)
      const room = filteredRooms.find((r: any) => r.id === roomId);
      const isPrivateRoom = room?.isPrivate || false;

      try {
        if (isPrivateRoom && role === "band_member") {
          // For private rooms, band members need approval
          setPendingRoomIntent({ roomId, role });
          await requestRoomApproval(roomId, userId, username, role);
          // Stay on lobby page during approval process
        } else {
          // For public rooms or audience members, join directly
          await connectToRoom(roomId, role);
          // Navigate to room page
          navigate(`/room/${roomId}`, { state: { role } });
        }
      } catch (error) {
        console.error("Failed to join room:", error);
      }
    },
    [
      username,
      userId,
      filteredRooms,
      clearRoom,
      requestRoomApproval,
      connectToRoom,
      navigate,
    ],
  );

  // Initialize lobby connection when component mounts
  useEffect(() => {
    if (
      username &&
      userId &&
      connectionState === ConnectionState.DISCONNECTED
    ) {
      connectToLobby();
    }
  }, [username, userId, connectionState, connectToLobby]);

  // Show username modal if no username is set
  useEffect(() => {
    if (!username) {
      setShowUsernameModal(true);
    }
  }, [username]);

  // Handle pending invite from sessionStorage
  useEffect(() => {
    if (username && userId) {
      const pendingInvite = sessionStorage.getItem("pendingInvite");
      if (pendingInvite) {
        try {
          const { roomId, role } = JSON.parse(pendingInvite);
          sessionStorage.removeItem("pendingInvite");
          handleJoinRoom(roomId, role);
        } catch (error) {
          console.error("Failed to parse pending invite:", error);
          sessionStorage.removeItem("pendingInvite");
        }
      }
    }
  }, [username, userId, handleJoinRoom]);

  // Set up room event handlers
  useEffect(() => {
    onRoomCreated(() => {
      // Refresh room list when a new room is created
      fetchRooms();
    });

    onRoomClosed(() => {
      // Refresh room list when a room is closed
      fetchRooms();
    });
  }, [onRoomCreated, onRoomClosed, fetchRooms]);

  // Handle errors
  useEffect(() => {
    if (error) {
      if (error.includes("rejected")) {
        setRejectionMessage(error);
        setShowRejectionModal(true);
      }
    }
  }, [error]);

  // Navigate to the room after approval (when socket transitions to IN_ROOM)
  useEffect(() => {
    if (connectionState === ConnectionState.IN_ROOM && pendingRoomIntent) {
      navigate(`/room/${pendingRoomIntent.roomId}`, {
        state: { role: pendingRoomIntent.role },
      });
      setPendingRoomIntent(null);
    }
  }, [connectionState, pendingRoomIntent, navigate]);

  // Expose cancel approval action for UI
  const cancelApproval = useCallback(async () => {
    try {
      await cancelApprovalRequest();
    } finally {
      setPendingRoomIntent(null);
    }
  }, [cancelApprovalRequest]);

  // Username management
  const handleUsernameClick = useCallback(() => {
    setTempUsername(username || "");
    setShowUsernameModal(true);
  }, [username]);

  const handleUsernameSubmit = useCallback(() => {
    if (!tempUsername.trim()) return;

    const newUsername = tempUsername.trim();
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setUsername(newUsername);
    setUserId(newUserId);
    setShowUsernameModal(false);
    setTempUsername("");

    // Connect to lobby after setting username
    if (connectionState === ConnectionState.DISCONNECTED) {
      connectToLobby();
    }
  }, [tempUsername, setUsername, setUserId, connectionState, connectToLobby]);

  const handleUsernameModalClose = useCallback(() => {
    if (username) {
      setShowUsernameModal(false);
      setTempUsername("");
    }
  }, [username]);

  // Room creation
  const handleCreateRoomButtonClick = useCallback(() => {
    if (!username) {
      setShowUsernameModal(true);
      return;
    }
    setShowCreateRoomModal(true);
  }, [username]);

  const handleCreateRoomSubmit = useCallback(async () => {
    if (!newRoomName.trim() || !username || !userId) return;

    try {
      const result = await createRoomAPI(
        newRoomName.trim(),
        username,
        userId,
        isPrivate,
        isHidden,
      );

      if (result.success) {
        // Refresh room list to show the new room
        fetchRooms();

        // Navigate to the new room
        navigate(`/room/${result.room.id}`);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      // You could add error handling here
    }

    setShowCreateRoomModal(false);
    setNewRoomName("");
    setIsPrivate(false);
    setIsHidden(false);
  }, [
    newRoomName,
    username,
    userId,
    isPrivate,
    isHidden,
    fetchRooms,
    navigate,
  ]);

  const handleCreateRoomModalClose = useCallback(() => {
    setShowCreateRoomModal(false);
    setNewRoomName("");
    setIsPrivate(false);
    setIsHidden(false);
  }, []);

  // Modal handlers
  const handleRejectionModalClose = useCallback(() => {
    setShowRejectionModal(false);
    setRejectionMessage("");
  }, []);

  return {
    // State
    username,
    rooms: filteredRooms,
    loading,
    showUsernameModal,
    tempUsername,
    showCreateRoomModal,
    newRoomName,
    showRejectionModal,
    rejectionMessage,
    isConnected: connectionState === ConnectionState.LOBBY,
    isConnecting,
    isPrivate,
    isHidden,
    connectionState,
    searchQuery,

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
    setIsPrivate,
    setIsHidden,
    setSearchQuery,

    // Socket for ping measurement
    activeSocket,
  };
};
