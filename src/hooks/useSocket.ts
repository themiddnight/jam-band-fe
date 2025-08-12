import { useRoomStore } from "../stores/roomStore";
import { useUserStore } from "../shared/stores/userStore";
import type { SynthState } from "../utils/InstrumentEngine";
import { throttle } from "lodash";
import { useRef, useCallback, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";

interface NoteData {
  notes: string[];
  velocity: number;
  instrument: string;
  category: string;
  eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off";
  isKeyHeld?: boolean;
}

interface NoteReceivedData {
  userId: string;
  username: string;
  notes: string[];
  velocity: number;
  instrument: string;
  category: string;
  eventType: "note_on" | "note_off" | "sustain_on" | "sustain_off";
  isKeyHeld?: boolean;
}

interface SynthParamsData {
  userId: string;
  username: string;
  instrument: string;
  category: string;
  params: Partial<SynthState>;
}

// Connection pool for better socket performance
interface ConnectionPool {
  connections: Map<string, Socket>;
  maxConnections: number;
  currentConnections: number;
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const roomCreatedCallbackRef = useRef<((room: any) => void) | null>(null);
  const roomClosedCallbackRef = useRef<((roomId: string) => void) | null>(null);
  const userLeftCallbackRef = useRef<((user: any) => void) | null>(null);
  const instrumentChangedCallbackRef = useRef<
    | ((data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => void)
    | null
  >(null);
  const synthParamsChangedCallbackRef = useRef<
    ((data: SynthParamsData) => void) | null
  >(null);
  const requestSynthParamsResponseCallbackRef = useRef<
    | ((data: { requestingUserId: string; requestingUsername: string }) => void)
    | null
  >(null);
  const guestCancelledCallbackRef = useRef<((userId: string) => void) | null>(
    null,
  );
  const memberRejectedCallbackRef = useRef<((userId: string) => void) | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnectedState] = useState(false);
  const pendingOperationsRef = useRef<Array<() => void>>([]);
  const lastRoomCreatedRef = useRef<string>("");
  const connectingRef = useRef<boolean>(false);
  const roomCreatedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Performance optimizations
  const messageQueueRef = useRef<
    Array<{ event: string; data: any; timestamp: number }>
  >([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_INTERVAL = 8; // Reduced from 16ms to 8ms for better responsiveness
  const MAX_QUEUE_SIZE = 100; // Increased from 50 to handle more messages

  // Deduplication for note events to prevent flaming
  const recentNoteEvents = useRef<Map<string, number>>(new Map());
  const NOTE_DEDUPE_WINDOW = 20; // Reduced from 30ms to 20ms for better responsiveness

  // Connection pooling for better performance
  const connectionPoolRef = useRef<ConnectionPool>({
    connections: new Map(),
    maxConnections: 3,
    currentConnections: 0,
  });

  // Get or create connection from pool
  const getConnection = useCallback((roomId: string): Socket => {
    const pool = connectionPoolRef.current;

    // Return existing connection if available
    if (pool.connections.has(roomId)) {
      const connection = pool.connections.get(roomId)!;
      if (connection.connected) {
        // Clear existing listeners to prevent duplicates
        connection.removeAllListeners();
        return connection;
      } else {
        // Remove disconnected connection
        pool.connections.delete(roomId);
        pool.currentConnections--;
      }
    }

    // Create new connection if under limit
    if (pool.currentConnections < pool.maxConnections) {
      const connection = io(
        import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
        {
          transports: ["websocket", "polling"],
          timeout: 20000,
          forceNew: true,
        },
      );

      pool.connections.set(roomId, connection);
      pool.currentConnections++;

      return connection;
    }

    // Reuse least recently used connection if at limit
    const oldestRoomId = pool.connections.keys().next().value;
    if (oldestRoomId) {
      const oldConnection = pool.connections.get(oldestRoomId)!;
      oldConnection.disconnect();
      pool.connections.delete(oldestRoomId);

      const newConnection = io(
        import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
        {
          transports: ["websocket", "polling"],
          timeout: 20000,
          forceNew: true,
        },
      );

      pool.connections.set(roomId, newConnection);
      return newConnection;
    }

    // Fallback to single connection
    return (
      socketRef.current ||
      io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001")
    );
  }, []);

  // Clean up connection pool
  const cleanupConnectionPool = useCallback(() => {
    const pool = connectionPoolRef.current;
    pool.connections.forEach((connection, roomId) => {
      if (!connection.connected) {
        connection.disconnect();
        pool.connections.delete(roomId);
        pool.currentConnections--;
      }
    });
  }, []);

  const {
    setCurrentRoom,
    setCurrentUser,
    setIsConnected,
    setPendingApproval,
    setError,
    addUser,
    removeUser,
    addPendingMember,
    removePendingMember,
    updateUserInstrument,
    transferOwnership,
    clearRoom,
  } = useRoomStore();

  // Execute pending operations when socket connects
  const executePendingOperations = useCallback(() => {
    while (pendingOperationsRef.current.length > 0) {
      const operation = pendingOperationsRef.current.shift();
      if (operation) {
        operation();
      }
    }
  }, []);

  // Optimized batch message processing for better performance
  const processMessageBatch = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    const messages = [...messageQueueRef.current];
    messageQueueRef.current = [];

    // Group messages by event type and user for efficient processing
    const groupedMessages = messages.reduce(
      (acc, msg) => {
        const key = `${msg.event}-${msg.data.userId || "global"}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(msg.data);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    // Process each group with latest data only
    Object.entries(groupedMessages).forEach(([key, dataArray]) => {
      if (socketRef.current?.connected) {
        const latestData = dataArray[dataArray.length - 1];
        socketRef.current.emit(key.split("-")[0], latestData);
      }
    });

    batchTimeoutRef.current = null;
  }, []);

  // Queue message for batched processing
  const queueMessage = useCallback(
    (event: string, data: any) => {
      // Add message to queue
      messageQueueRef.current.push({ event, data, timestamp: Date.now() });

      // Limit queue size to prevent memory leaks
      if (messageQueueRef.current.length > MAX_QUEUE_SIZE) {
        messageQueueRef.current = messageQueueRef.current.slice(
          -MAX_QUEUE_SIZE / 2,
        );
      }

      // Schedule batch processing if not already scheduled
      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(
          processMessageBatch,
          BATCH_INTERVAL,
        );
      }
    },
    [processMessageBatch],
  );

  // Safe emit function that waits for connection
  const safeEmit = useCallback(
    (event: string, data: any) => {
      if (socketRef.current?.connected) {
        // For real-time events like notes, emit immediately
        if (event === "play_note" || event === "change_instrument") {
          socketRef.current.emit(event, data);
        } else {
          // For other events, use batching
          queueMessage(event, data);
        }
      } else {
        // Queue the operation to execute when connected
        pendingOperationsRef.current.push(() => {
          if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
          }
        });
      }
    },
    [queueMessage],
  );

  // Throttled emit for synth parameters with lodash
  const throttledEmit = useMemo(
    () =>
      throttle((event: string, data: any) => {
        safeEmit(event, data);
      }, 16),
    [safeEmit],
  );

  // Connect to socket server with connection pooling
  const connect = useCallback(
    (roomId?: string) => {
      if (
        socketRef.current?.connected ||
        isConnecting ||
        connectingRef.current
      ) {
        return;
      }

      // Clean up existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      connectingRef.current = true;
      setIsConnecting(true);

      // Use connection pool if roomId is provided, otherwise use single connection
      let socket: Socket;
      if (roomId) {
        socket = getConnection(roomId);
      } else {
        // Use environment variable for backend URL
        const backendUrl =
          import.meta.env.VITE_API_URL || "http://localhost:3001";
        socket = io(backendUrl, {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });
      }

      // Clear any existing listeners to prevent duplicates
      socket.removeAllListeners();

      socketRef.current = socket;

      socket.on("connect", () => {
        connectingRef.current = false;
        setIsConnected(true);
        setIsConnectedState(true);
        setError(null);
        setIsConnecting(false);

        // Execute any pending operations
        executePendingOperations();
      });

      socket.on("disconnect", () => {
        connectingRef.current = false;
        setIsConnected(false);
        setIsConnectedState(false);
        setIsConnecting(false);
        setError("Connection lost");
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
        connectingRef.current = false;
        setIsConnecting(false);
        setError("Failed to connect to server");
      });

      socket.on("error", (data: { message: string }) => {
        console.error("Socket error:", data.message);
        setError(data.message);
      });

      // Room events
      socket.on("room_created", (data: { room: any; user: any }) => {
        setCurrentRoom(data.room);
        setCurrentUser(data.user);
        setError(null);
      });

      socket.on(
        "room_created_broadcast",
        (data: {
          id: string;
          name: string;
          userCount: number;
          owner: string;
          isPrivate: boolean;
          isHidden: boolean;
          createdAt: string;
        }) => {
          // Clear any existing timeout for the previous room
          if (roomCreatedTimeoutRef.current) {
            clearTimeout(roomCreatedTimeoutRef.current);
          }

          // Prevent duplicate calls for the same room within a longer window
          if (lastRoomCreatedRef.current === data.id) {
            return;
          }

          lastRoomCreatedRef.current = data.id;
          if (roomCreatedCallbackRef.current) {
            roomCreatedCallbackRef.current(data);
          }

          // Reset the last room created reference after a longer delay
          roomCreatedTimeoutRef.current = setTimeout(() => {
            if (lastRoomCreatedRef.current === data.id) {
              lastRoomCreatedRef.current = "";
            }
            roomCreatedTimeoutRef.current = null;
          }, 5000); // Increased from 1 second to 5 seconds
        },
      );

      socket.on(
        "room_joined",
        (data: { room: any; users: any[]; pendingMembers: any[] }) => {
          setCurrentRoom({
            ...data.room,
            users: data.users,
            pendingMembers: data.pendingMembers,
          });

          // Set currentUser based on the current userId
          const currentUserId = useUserStore.getState().userId;
          if (currentUserId) {
            const currentUserData = data.users.find(
              (user: any) => user.id === currentUserId,
            );
            if (currentUserData) {
              setCurrentUser(currentUserData);
            }
          }

          setError(null);
        },
      );

      socket.on("user_joined", (data: { user: any }) => {
        addUser(data.user);
      });

      socket.on("user_left", (data: { user: any }) => {
        removeUser(data.user.id);

        // Call the callback if set
        if (userLeftCallbackRef.current) {
          userLeftCallbackRef.current(data.user);
        }
      });

      socket.on("member_request", (data: { user: any }) => {
        addPendingMember(data.user);
      });

      socket.on("member_approved", (data: { user?: any; room?: any }) => {
        if (data.user) {
          removePendingMember(data.user.id);
          addUser(data.user);
        }
        if (data.room) {
          setCurrentRoom(data.room);
          // Clear pending approval since the user has been approved
          setPendingApproval(false);

          // Update currentUser if this approval is for the current user
          const currentUserId = useUserStore.getState().userId;
          if (currentUserId) {
            const approvedUser = data.room.users.find(
              (user: any) => user.id === currentUserId,
            );
            if (approvedUser) {
              setCurrentUser(approvedUser);
            }
          }
        }
      });

      socket.on("room_state_updated", (data: { room: any }) => {
        setCurrentRoom(data.room);
      });

      socket.on(
        "member_rejected",
        (data: { message: string; userId?: string }) => {
          // Clear pending approval state and room
          setPendingApproval(false);
          clearRoom();

          // Disconnect socket and redirect to lobby for rejected users
          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
          }

          // Reset connection states
          setIsConnected(false);
          setIsConnectedState(false);
          setIsConnecting(false);

          // Redirect to lobby with error message
          setError("Your request to join was rejected by the room owner");

          // Call the callback if set (for room owner to clear pending approval prompt)
          if (memberRejectedCallbackRef.current && data.userId) {
            memberRejectedCallbackRef.current(data.userId);
          }
        },
      );

      socket.on("pending_approval", () => {
        setPendingApproval(true);
      });

      socket.on(
        "ownership_transferred",
        (data: { newOwner: any; oldOwner: any }) => {
          transferOwnership(data.newOwner.id);
        },
      );

      socket.on("room_closed", (data: { message: string }) => {
        setError(data.message);
        clearRoom();
      });

      socket.on("room_closed_broadcast", (data: { roomId: string }) => {
        if (roomClosedCallbackRef.current) {
          roomClosedCallbackRef.current(data.roomId);
        }
        clearRoom();
      });

      socket.on("leave_confirmed", () => {
        // Clear room state when backend confirms successful leave
        clearRoom();
      });

      // Note: The note_played event is handled by the onNoteReceived callback
      // No need for a separate listener here

      socket.on(
        "instrument_changed",
        (data: {
          userId: string;
          username: string;
          instrument: string;
          category: string;
        }) => {
          // Update the room store first
          updateUserInstrument(data.userId, data.instrument, data.category);

          // Call the callback if set
          if (instrumentChangedCallbackRef.current) {
            instrumentChangedCallbackRef.current(data);
          }
        },
      );

      socket.on("synth_params_changed", (data: SynthParamsData) => {
        // Call the callback if set
        if (synthParamsChangedCallbackRef.current) {
          synthParamsChangedCallbackRef.current(data);
        }
      });

      socket.on(
        "request_synth_params_response",
        (data: { requestingUserId: string; requestingUsername: string }) => {
          // Call the callback if set
          if (requestSynthParamsResponseCallbackRef.current) {
            requestSynthParamsResponseCallbackRef.current(data);
          }
        },
      );

      // Chat message handler
      socket.on("chat_message", (data: any) => {
        // Call the global handler if it exists
        if ((window as any).handleChatMessage) {
          (window as any).handleChatMessage(data);
        }
      });
    },
    [
      isConnecting,
      setIsConnected,
      setError,
      getConnection,
      executePendingOperations,
      setCurrentRoom,
      setCurrentUser,
      addUser,
      removeUser,
      addPendingMember,
      removePendingMember,
      setPendingApproval,
      clearRoom,
      transferOwnership,
      updateUserInstrument,
    ],
  );

  // Create room
  const createRoom = useCallback(
    (
      name: string,
      username: string,
      userId: string,
      isPrivate: boolean = false,
      isHidden: boolean = false,
    ) => {
      safeEmit("create_room", { name, username, userId, isPrivate, isHidden });
    },
    [safeEmit],
  );

  // Join room
  const joinRoom = useCallback(
    (
      roomId: string,
      username: string,
      userId: string,
      role: "band_member" | "audience",
    ) => {
      safeEmit("join_room", { roomId, username, userId, role });
    },
    [safeEmit],
  );

  // Leave room
  const leaveRoom = useCallback(
    (isIntendedLeave: boolean = false) => {
      safeEmit("leave_room", { isIntendedLeave });

      // Don't clear room state immediately - let the disconnect and navigation handle it
      // This prevents the room interface from showing before the backend confirms the leave
    },
    [safeEmit],
  );

  // Disconnect socket completely with connection pool cleanup
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Clean up connection pool
    cleanupConnectionPool();

    clearRoom();
  }, [clearRoom, cleanupConnectionPool]);

  // Approve member
  const approveMember = useCallback(
    (userId: string) => {
      safeEmit("approve_member", { userId });
    },
    [safeEmit],
  );

  // Reject member
  const rejectMember = useCallback(
    (userId: string) => {
      safeEmit("reject_member", { userId });
    },
    [safeEmit],
  );

  // Transfer ownership
  const transferOwnershipTo = useCallback(
    (newOwnerId: string) => {
      safeEmit("transfer_ownership", { newOwnerId });
    },
    [safeEmit],
  );

  // Optimized playNote with better deduplication
  const playNote = useCallback(
    (data: NoteData) => {
      // For mono synths, be more careful with deduplication to preserve key tracking
      const isMonoSynth =
        data.instrument === "analog_mono" || data.instrument === "fm_mono";
      const isDrumMachine = data.category === "DrumBeat";

      // Create a unique key for this note event
      const eventKey = `${data.eventType}-${data.notes.join(",")}-${data.instrument}-${data.velocity}`;
      const now = Date.now();

      // Use different deduplication strategies based on instrument type
      let dedupeWindow = NOTE_DEDUPE_WINDOW;
      let shouldCheckDuplicate = true;

      if (isDrumMachine) {
        // For drum machines, use a much shorter deduplication window to allow rapid hits
        dedupeWindow = 10; // Reduced from 15ms to 10ms for drums
        shouldCheckDuplicate = data.eventType === "note_on";
      } else if (isMonoSynth) {
        // For mono synths, only check note_on events for deduplication
        shouldCheckDuplicate = data.eventType === "note_on";
      }

      if (shouldCheckDuplicate) {
        // Check if we recently sent the same event
        const lastSent = recentNoteEvents.current.get(eventKey);
        if (lastSent && now - lastSent < dedupeWindow) {
          // Skip duplicate note events silently
          return;
        }
      }

      // Record this event and emit immediately for real-time performance
      recentNoteEvents.current.set(eventKey, now);
      safeEmit("play_note", data);

      // Clean up old entries periodically to prevent memory leaks
      if (recentNoteEvents.current.size > 200) {
        // Increased from 100
        const cutoff = now - Math.max(NOTE_DEDUPE_WINDOW, dedupeWindow) * 3;
        for (const [key, timestamp] of recentNoteEvents.current.entries()) {
          if (timestamp < cutoff) {
            recentNoteEvents.current.delete(key);
          }
        }
      }
    },
    [safeEmit],
  );

  // Change instrument
  const changeInstrument = useCallback(
    (instrument: string, category: string) => {
      safeEmit("change_instrument", { instrument, category });
    },
    [safeEmit],
  );

  // Update synthesizer parameters (throttled for real-time updates)
  const updateSynthParams = useCallback(
    (params: Partial<SynthState>) => {
      throttledEmit("update_synth_params", { params });
    },
    [throttledEmit],
  );

  // Request synth parameters from other users (for new users joining)
  const requestSynthParams = useCallback(() => {
    safeEmit("request_synth_params", {});
  }, [safeEmit]);

  // Handle note received
  const onNoteReceived = useCallback(
    (callback: (data: NoteReceivedData) => void) => {
      if (!socketRef.current) return () => {};

      const handleNoteReceived = (data: NoteReceivedData) => {
        callback(data);
      };

      socketRef.current.on("note_played", handleNoteReceived);

      return () => {
        if (socketRef.current) {
          socketRef.current.off("note_played", handleNoteReceived);
        }
      };
    },
    [],
  );

  // Set room created callback
  const onRoomCreated = useCallback((callback: (room: any) => void) => {
    console.log("Setting room created callback");
    roomCreatedCallbackRef.current = callback;
  }, []);

  // Set room closed callback
  const onRoomClosed = useCallback((callback: (roomId: string) => void) => {
    roomClosedCallbackRef.current = callback;
  }, []);

  // Set user left callback
  const onUserLeft = useCallback((callback: (user: any) => void) => {
    userLeftCallbackRef.current = callback;
  }, []);

  // Set instrument changed callback
  const onInstrumentChanged = useCallback(
    (
      callback: (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => void,
    ) => {
      instrumentChangedCallbackRef.current = callback;
    },
    [],
  );

  // Set synth params changed callback
  const onSynthParamsChanged = useCallback(
    (callback: (data: SynthParamsData) => void) => {
      synthParamsChangedCallbackRef.current = callback;
    },
    [],
  );

  // Set request synth params response callback
  const onRequestSynthParamsResponse = useCallback(
    (
      callback: (data: {
        requestingUserId: string;
        requestingUsername: string;
      }) => void,
    ) => {
      requestSynthParamsResponseCallbackRef.current = callback;
    },
    [],
  );

  // Set guest cancelled callback
  const onGuestCancelled = useCallback((callback: (userId: string) => void) => {
    guestCancelledCallbackRef.current = callback;
  }, []);

  // Set member rejected callback
  const onMemberRejected = useCallback((callback: (userId: string) => void) => {
    memberRejectedCallbackRef.current = callback;
  }, []);

  // Cleanup function for performance optimizations
  const cleanup = useCallback(() => {
    // Clear any pending batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Clear room creation timeout
    if (roomCreatedTimeoutRef.current) {
      clearTimeout(roomCreatedTimeoutRef.current);
      roomCreatedTimeoutRef.current = null;
    }

    // Process any remaining messages in queue
    if (messageQueueRef.current.length > 0) {
      processMessageBatch();
    }

    // Clear recent note events
    recentNoteEvents.current.clear();
  }, [processMessageBatch]);

  // Send chat message
  const sendChatMessage = useCallback(
    (message: string, roomId: string) => {
      safeEmit("chat_message", { message, roomId });
    },
    [safeEmit],
  );

  return {
    connect,
    createRoom,
    joinRoom,
    leaveRoom,
    disconnect,
    approveMember,
    rejectMember,
    transferOwnershipTo,
    playNote,
    changeInstrument,
    updateSynthParams,
    requestSynthParams,
    sendChatMessage,

    onNoteReceived,
    onRoomCreated,
    onRoomClosed,
    onUserLeft,
    onInstrumentChanged,
    onSynthParamsChanged,
    onRequestSynthParamsResponse,
    onGuestCancelled,
    onMemberRejected,
    isConnected: isConnected,
    isConnecting,
    socketRef, // Expose the socket instance
    cleanup, // Expose cleanup function
  };
};
