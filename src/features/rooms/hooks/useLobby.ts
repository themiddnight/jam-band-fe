import { useRoomSocket } from "@/features/audio/hooks/useRoomSocket";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { useRoomQuery, useRoomStore } from "@/features/rooms";
import { createRoom as createRoomAPI } from "@/features/rooms/services/api";
import { useUserStore } from "@/shared/stores/userStore";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import type { RoomType } from "@/shared/types";

/**
 * Lobby hook using the RoomSocketManager for namespace-based connections
 */
export const useLobby = () => {
  const navigate = useNavigate();

  // User state
  const { username, userId, setUsername, setUserId, isAuthenticated, userType, setAsGuest } = useUserStore();
  const isGuest = userType === "GUEST" || !isAuthenticated;
  
  // Auth choice modal state
  const [showAuthChoiceModal, setShowAuthChoiceModal] = useState(false);
  
  // Check session storage on mount to see if user already chose
  const [hasChosenAuth, setHasChosenAuth] = useState(() => {
    return !!sessionStorage.getItem("auth_choice_made");
  });

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
    onRoomUpdated,
  } = useRoomSocket();

  // Room store
  const { clearRoom } = useRoomStore();

  // Get the current active socket directly instead of using a ref/state
  // This ensures the socket is always fresh and avoids timing issues with ping measurement
  const activeSocket = getActiveSocket();

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
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [newRoomType, setNewRoomType] = useState<RoomType>("perform");
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
      const roomType = room?.roomType || "perform";

      try {
        // Guest limitations: cannot join private rooms
        if (isGuest && isPrivateRoom) {
          alert("Guest users cannot join private rooms. Please sign up to access this feature.");
          navigate("/register");
          return;
        }

        if (isPrivateRoom && role === "band_member") {
          // For private rooms, band members need approval
          setPendingRoomIntent({ roomId, role });
          await requestRoomApproval(roomId, userId, username, role);
          // Stay on lobby page during approval process
        } else {
          // For public rooms or audience members, join directly
          await connectToRoom(roomId, role);
          // Navigate to room page based on room type
          const roomPath = roomType === "arrange" ? "arrange" : "perform";
          navigate(`/${roomPath}/${roomId}`, { state: { role } });
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
      isGuest,
      requestRoomApproval,
      connectToRoom,
      navigate,
    ],
  );

  // Initialize lobby connection when component mounts or when username/userId changes
  useEffect(() => {
    if (
      username &&
      userId &&
      connectionState === ConnectionState.DISCONNECTED
    ) {
      console.log("🔌 Connecting to lobby with:", { username, userId, isAuthenticated, userType });
      connectToLobby();
    }
  }, [username, userId, connectionState, connectToLobby, isAuthenticated, userType]);

  // Ensure guest username persists after leaving room
  useEffect(() => {
    // If user is guest and has chosen auth but lost username, restore it
    const sessionAuthChoice = sessionStorage.getItem("auth_choice_made");
    if (!isAuthenticated && sessionAuthChoice === "guest" && !username) {
      console.log("🔄 Restoring guest username after room leave");
      setAsGuest();
    }
  }, [isAuthenticated, username, setAsGuest]);

  // Clear session auth choice when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.removeItem("auth_choice_made");
      setHasChosenAuth(false);
    }
  }, [isAuthenticated]);

  // Update connection when authentication state changes
  useEffect(() => {
    if (isAuthenticated && username && userId && connectionState === ConnectionState.DISCONNECTED) {
      connectToLobby();
    }
  }, [isAuthenticated, username, userId, connectionState, connectToLobby]);

  // Show auth choice modal if user is not authenticated and hasn't chosen yet
  useEffect(() => {
    // Check if user has chosen auth method in this session
    const sessionAuthChoice = sessionStorage.getItem("auth_choice_made");
    
    // Only show modal if not authenticated, hasn't chosen in this render, and no session choice
    // Also check if user has username (which means they've chosen guest)
    if (!isAuthenticated && !hasChosenAuth && !sessionAuthChoice && !username) {
      setShowAuthChoiceModal(true);
    } else {
      // Close modal when authenticated, has chosen, or has username (guest chosen)
      setShowAuthChoiceModal(false);
    }
  }, [isAuthenticated, hasChosenAuth, username]);

  // Handle guest entry
  const handleGuestEnter = useCallback(() => {
    // Check if already a guest with username and userId
    const currentState = useUserStore.getState();
    if (currentState.userType === "GUEST" && currentState.username && currentState.userId) {
      console.log("🎭 Already a guest, keeping existing username and userId");
      // Just mark as chosen and ensure connection
      setHasChosenAuth(true);
      sessionStorage.setItem("auth_choice_made", "guest");
      
      // Ensure connection if disconnected
      if (connectionState === ConnectionState.DISCONNECTED && currentState.username && currentState.userId) {
        connectToLobby();
      }
      return;
    }
    
    console.log("🎭 Entering as guest...");
    setAsGuest();
    setHasChosenAuth(true);
    // Mark that user has chosen auth method in this session (but don't persist across refresh)
    sessionStorage.setItem("auth_choice_made", "guest");
    
    // The useEffect for username/userId will handle the connection
    // No need to manually connect here
  }, [setAsGuest, connectionState, connectToLobby]);

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

    onRoomUpdated(() => {
      // Refresh room list when a room is updated
      fetchRooms();
    });
  }, [onRoomCreated, onRoomClosed, onRoomUpdated, fetchRooms]);

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
      // Find the room to get its type
      const room = filteredRooms.find((r: any) => r.id === pendingRoomIntent.roomId);
      const roomType = room?.roomType || "perform";
      const roomPath = roomType === "arrange" ? "arrange" : "perform";
      
      navigate(`/${roomPath}/${pendingRoomIntent.roomId}`, {
        state: { role: pendingRoomIntent.role },
      });
      setPendingRoomIntent(null);
    }
  }, [connectionState, pendingRoomIntent, navigate, filteredRooms]);

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
    console.log("🏠 Create room button clicked", { username, userId, isAuthenticated, userType });
    
    if (!isAuthenticated) {
      // For guests, check if they have username
      if (!username) {
        console.log("⚠️ No username, showing auth choice modal");
        setShowAuthChoiceModal(true);
        return;
      }
    }
    
    if (!username || !userId) {
      console.log("⚠️ Missing username or userId", { username, userId });
      // Show auth choice modal if not authenticated, otherwise show username modal
      if (!isAuthenticated) {
        setShowAuthChoiceModal(true);
      } else {
        setShowUsernameModal(true);
      }
      return;
    }
    
    // Guests can create rooms (no limitation)
    console.log("✅ Opening create room modal");
    setShowCreateRoomModal(true);
  }, [username, userId, isAuthenticated, userType]);

  const handleCreateRoomSubmit = useCallback(async () => {
    if (!newRoomName.trim() || !username || !userId) return;

    try {
      const result = await createRoomAPI(
        newRoomName.trim(),
        username,
        userId,
        isPrivate,
        isHidden,
        newRoomDescription.trim() || undefined,
        newRoomType,
      );

      if (result.success) {
        // Refresh room list to show the new room
        fetchRooms();

        // Navigate to the new room based on room type
        const roomPath = result.room.roomType === "arrange" ? "arrange" : "perform";
        navigate(`/${roomPath}/${result.room.id}`);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      // You could add error handling here
    }

    setShowCreateRoomModal(false);
    setNewRoomName("");
    setNewRoomDescription("");
    setNewRoomType("perform");
    setIsPrivate(false);
    setIsHidden(false);
  }, [
    newRoomName,
    newRoomDescription,
    newRoomType,
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
    setNewRoomDescription("");
    setNewRoomType("perform");
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
    showAuthChoiceModal,
    tempUsername,
    showCreateRoomModal,
    newRoomName,
    newRoomDescription,
    newRoomType,
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
    handleGuestEnter,

    // Setters
    setTempUsername,
    setNewRoomName,
    setNewRoomDescription,
    setNewRoomType,
    setIsPrivate,
    setIsHidden,
    setSearchQuery,

    // Socket for ping measurement
    activeSocket,
  };
};
