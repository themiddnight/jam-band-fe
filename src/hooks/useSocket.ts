import { useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRoomStore } from "../stores/roomStore";
import { useUserStore } from "../stores/userStore";
import type { SynthState } from "../utils/InstrumentEngine";
import { throttle } from "lodash";

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
    ((data: { requestingUserId: string; requestingUsername: string }) => void) | null
  >(null);
  const guestCancelledCallbackRef = useRef<((userId: string) => void) | null>(
    null
  );
  const memberRejectedCallbackRef = useRef<((userId: string) => void) | null>(
    null
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnectedState] = useState(false);
  const pendingOperationsRef = useRef<Array<() => void>>([]);
  const lastRoomCreatedRef = useRef<string>("");
  const connectingRef = useRef<boolean>(false);

  // Performance optimizations
  const messageQueueRef = useRef<Array<{ event: string; data: any; timestamp: number }>>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_INTERVAL = 16; // ~60fps for real-time updates
  const MAX_QUEUE_SIZE = 50; // Prevent memory leaks

  // Deduplication for note events to prevent flaming
  const recentNoteEvents = useRef<Map<string, number>>(new Map());
  const NOTE_DEDUPE_WINDOW = 30; // Reduced from 50ms to 30ms for better responsiveness

  const {
    setCurrentRoom,
    setCurrentUser,
    setIsConnected,
    setPendingApproval,
    setError,
    setRejectionMessage,
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

  // Batch message processing for better performance
  const processMessageBatch = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    const messages = [...messageQueueRef.current];
    messageQueueRef.current = [];

    // Group messages by event type for efficient processing
    const groupedMessages = messages.reduce((acc, msg) => {
      if (!acc[msg.event]) {
        acc[msg.event] = [];
      }
      acc[msg.event].push(msg.data);
      return acc;
    }, {} as Record<string, any[]>);

    // Process each group
    Object.entries(groupedMessages).forEach(([event, dataArray]) => {
      if (socketRef.current?.connected) {
        // For most events, send the latest data only
        const latestData = dataArray[dataArray.length - 1];
        socketRef.current.emit(event, latestData);
      }
    });

    batchTimeoutRef.current = null;
  }, []);

  // Queue message for batched processing
  const queueMessage = useCallback((event: string, data: any) => {
    // Add message to queue
    messageQueueRef.current.push({ event, data, timestamp: Date.now() });

    // Limit queue size to prevent memory leaks
    if (messageQueueRef.current.length > MAX_QUEUE_SIZE) {
      messageQueueRef.current = messageQueueRef.current.slice(-MAX_QUEUE_SIZE / 2);
    }

    // Schedule batch processing if not already scheduled
    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(processMessageBatch, BATCH_INTERVAL);
    }
  }, [processMessageBatch]);

  // Safe emit function that waits for connection
  const safeEmit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      // For real-time events like notes, emit immediately
      if (event === 'play_note' || event === 'change_instrument') {
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
  }, [queueMessage]);

  // Throttled emit for synth parameters with lodash
  const throttledEmit = useCallback(
    (event: string, data: any) => {
      throttle((evt: string, dat: any) => {
        safeEmit(evt, dat);
      }, 16)(event, data);
    },
    [safeEmit]
  );

  // Connect to socket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected || isConnecting || connectingRef.current) {
      console.log(
        "Socket already connected, connecting, or connection in progress, skipping"
      );
      return;
    }

    // Clean up existing socket if any
    if (socketRef.current) {
      console.log("Cleaning up existing socket connection");
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log("Creating new socket connection");
    connectingRef.current = true;
    setIsConnecting(true);

    // Use environment variable for backend URL
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
    const socket = io(backendUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
      connectingRef.current = false;
      setIsConnected(true);
      setIsConnectedState(true);
      setError(null);
      setIsConnecting(false);

      // Execute any pending operations
      executePendingOperations();
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
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
      console.log("Room created:", data);
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
        createdAt: string;
      }) => {
        console.log("Room created broadcast received:", data);

        // Prevent duplicate calls for the same room
        if (lastRoomCreatedRef.current === data.id) {
          console.log(
            "Skipping duplicate room created broadcast for:",
            data.id
          );
          return;
        }

        lastRoomCreatedRef.current = data.id;
        if (roomCreatedCallbackRef.current) {
          roomCreatedCallbackRef.current(data);
        }

        // Reset the last room created reference after a delay to allow for legitimate duplicates
        setTimeout(() => {
          if (lastRoomCreatedRef.current === data.id) {
            lastRoomCreatedRef.current = "";
          }
        }, 1000);
      }
    );

    socket.on(
      "room_joined",
      (data: {
        room: any;
        users: any[];
        pendingMembers: any[];
      }) => {
        console.log("Room joined:", data);
        setCurrentRoom({
          ...data.room,
          users: data.users,
          pendingMembers: data.pendingMembers,
        });

        // Set currentUser based on the current username
        const currentUsername = useUserStore.getState().username;
        if (currentUsername) {
          const currentUserData = data.users.find(
            (user: any) => user.username === currentUsername
          );
          if (currentUserData) {
            console.log(
              "Setting current user from room_joined:",
              currentUserData
            );
            setCurrentUser(currentUserData);
          }
        }

        setError(null);
      }
    );

    socket.on("user_joined", (data: { user: any }) => {
      console.log("User joined:", data.user);
      addUser(data.user);
    });

    socket.on("user_left", (data: { user: any }) => {
      console.log("User left:", data.user);
      removeUser(data.user.id);

      // Call the callback if set
      if (userLeftCallbackRef.current) {
        userLeftCallbackRef.current(data.user);
      }
    });

    socket.on("member_request", (data: { user: any }) => {
      console.log("Member request:", data.user);
      addPendingMember(data.user);
    });

    socket.on("member_approved", (data: { user?: any; room?: any }) => {
      if (data.user) {
        console.log("Member approved:", data.user);
        removePendingMember(data.user.id);
        addUser(data.user);
      }
      if (data.room) {
        console.log("Room updated after approval:", data.room);
        setCurrentRoom(data.room);
        // Clear pending approval since the user has been approved
        setPendingApproval(false);

        // Update currentUser if this approval is for the current user
        const currentUsername = useUserStore.getState().username;
        if (currentUsername) {
          const approvedUser = data.room.users.find(
            (user: any) => user.username === currentUsername
          );
          if (approvedUser) {
            console.log("Updating current user after approval:", approvedUser);
            setCurrentUser(approvedUser);
          }
        }
      }
    });

    socket.on("room_state_updated", (data: { room: any }) => {
      console.log("Room state updated:", data.room);
      setCurrentRoom(data.room);
    });

    socket.on(
      "member_rejected",
      (data: { message: string; userId?: string }) => {
        console.log("Member rejected:", data.message);
        // Set rejection message instead of error for proper handling
        setRejectionMessage(data.message);
        // Clear pending approval state
        setPendingApproval(false);
        clearRoom();
        
        // Disconnect the socket to prevent any further interaction
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        
        // Reset connection states
        setIsConnected(false);
        setIsConnectedState(false);
        setIsConnecting(false);

        // Call the callback if set (for room owner to clear pending approval prompt)
        if (memberRejectedCallbackRef.current && data.userId) {
          memberRejectedCallbackRef.current(data.userId);
        }
      }
    );



    socket.on("pending_approval", (data: { message: string }) => {
      console.log("Pending approval:", data.message);
      setPendingApproval(true);
    });

    socket.on(
      "ownership_transferred",
      (data: { newOwner: any; oldOwner: any }) => {
        console.log("Ownership transferred:", data);
        transferOwnership(data.newOwner.id);
      }
    );

    socket.on("room_closed", (data: { message: string }) => {
      console.log("Room closed:", data.message);
      setError(data.message);
      clearRoom();
    });

    socket.on("room_closed_broadcast", (data: { roomId: string }) => {
      console.log("Room closed broadcast:", data.roomId);
      if (roomClosedCallbackRef.current) {
        roomClosedCallbackRef.current(data.roomId);
      }
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
        console.log("🎵 Socket: Instrument changed:", data);

        // Update the room store first
        updateUserInstrument(data.userId, data.instrument, data.category);
        
        console.log(`✅ Updated instrument for user ${data.username}: ${data.instrument} (${data.category})`);

        // Call the callback if set
        if (instrumentChangedCallbackRef.current) {
          console.log("🔄 Calling instrument changed callback");
          instrumentChangedCallbackRef.current(data);
        }
      }
    );

    socket.on("synth_params_changed", (data: SynthParamsData) => {
      console.log("🎛️ Socket: Synth parameters changed:", data);

      // Call the callback if set
      if (synthParamsChangedCallbackRef.current) {
        console.log("🔄 Calling synth params changed callback");
        synthParamsChangedCallbackRef.current(data);
      }
    });

    socket.on("request_synth_params_response", (data: { requestingUserId: string; requestingUsername: string }) => {
      console.log("🎛️ Socket: Synth params request received:", data);

      // Call the callback if set
      if (requestSynthParamsResponseCallbackRef.current) {
        console.log("🔄 Calling request synth params response callback");
        requestSynthParamsResponseCallbackRef.current(data);
      }
    });


  }, [
    isConnecting,
    setIsConnected,
    setError,
    executePendingOperations,
    setCurrentRoom,
    setCurrentUser,
    addUser,
    removeUser,
    addPendingMember,
    removePendingMember,
    setPendingApproval,
    setRejectionMessage,
    clearRoom,
    transferOwnership,
    updateUserInstrument,

  ]);

  // Create room
  const createRoom = useCallback(
    (name: string, username: string) => {
      safeEmit("create_room", { name, username });
    },
    [safeEmit]
  );

  // Join room
  const joinRoom = useCallback(
    (roomId: string, username: string, role: "band_member" | "audience") => {
      safeEmit("join_room", { roomId, username, role });
    },
    [safeEmit]
  );

  // Leave room
  const leaveRoom = useCallback(() => {
    safeEmit("leave_room", {});

    // Clear room state immediately to prevent reconnection
    clearRoom();
  }, [safeEmit, clearRoom]);

  // Disconnect socket completely
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    clearRoom();
  }, [clearRoom]);

  // Approve member
  const approveMember = useCallback(
    (userId: string) => {
      safeEmit("approve_member", { userId });
    },
    [safeEmit]
  );

  // Reject member
  const rejectMember = useCallback(
    (userId: string) => {
      safeEmit("reject_member", { userId });
    },
    [safeEmit]
  );

  // Transfer ownership
  const transferOwnershipTo = useCallback(
    (newOwnerId: string) => {
      safeEmit("transfer_ownership", { newOwnerId });
    },
    [safeEmit]
  );

  // Play note with selective deduplication to prevent flaming while preserving mono synth behavior
  const playNote = useCallback(
    (data: NoteData) => {
      // For mono synths, be more careful with deduplication to preserve key tracking
      const isMonoSynth = data.instrument === "analog_mono" || data.instrument === "fm_mono";
      const isDrumMachine = data.category === "DrumBeat";
      
      // Create a unique key for this note event
      const eventKey = `${data.eventType}-${data.notes.join(',')}-${data.instrument}-${data.velocity}`;
      const now = Date.now();
      
      // Use different deduplication strategies based on instrument type
      let dedupeWindow = NOTE_DEDUPE_WINDOW;
      let shouldCheckDuplicate = true;
      
      if (isDrumMachine) {
        // For drum machines, use a much shorter deduplication window to allow rapid hits
        dedupeWindow = 15; // Reduced from 50ms to 15ms for drums
        // Only deduplicate identical note events, not all events
        shouldCheckDuplicate = data.eventType === "note_on";
      } else if (isMonoSynth) {
        // For mono synths, only check note_on events for deduplication
        shouldCheckDuplicate = data.eventType === "note_on";
      }
      
      if (shouldCheckDuplicate) {
        // Check if we recently sent the same event
        const lastSent = recentNoteEvents.current.get(eventKey);
        if (lastSent && (now - lastSent) < dedupeWindow) {
          // Skip duplicate note events silently
          return;
        }
      }
      
      // Record this event and emit
      recentNoteEvents.current.set(eventKey, now);
      safeEmit("play_note", data);
      
      // Clean up old entries periodically to prevent memory leaks
      if (recentNoteEvents.current.size > 100) {
        const cutoff = now - Math.max(NOTE_DEDUPE_WINDOW, dedupeWindow) * 2;
        for (const [key, timestamp] of recentNoteEvents.current.entries()) {
          if (timestamp < cutoff) {
            recentNoteEvents.current.delete(key);
          }
        }
      }
    },
    [safeEmit]
  );

  // Change instrument
  const changeInstrument = useCallback(
    (instrument: string, category: string) => {
      safeEmit("change_instrument", { instrument, category });
    },
    [safeEmit]
  );

  // Update synthesizer parameters (throttled for real-time updates)
  const updateSynthParams = useCallback(
    (params: Partial<SynthState>) => {
      throttledEmit("update_synth_params", { params });
    },
    [throttledEmit]
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
    []
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
      }) => void
    ) => {
      instrumentChangedCallbackRef.current = callback;
    },
    []
  );

  // Set synth params changed callback
  const onSynthParamsChanged = useCallback(
    (callback: (data: SynthParamsData) => void) => {
      synthParamsChangedCallbackRef.current = callback;
    },
    []
  );

  // Set request synth params response callback
  const onRequestSynthParamsResponse = useCallback(
    (callback: (data: { requestingUserId: string; requestingUsername: string }) => void) => {
      requestSynthParamsResponseCallbackRef.current = callback;
    },
    []
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
    
    // Process any remaining messages in queue
    if (messageQueueRef.current.length > 0) {
      processMessageBatch();
    }
    
    // Clear recent note events
    recentNoteEvents.current.clear();
  }, [processMessageBatch]);

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
