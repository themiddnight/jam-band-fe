import { RoomSocketManager } from "../services/RoomSocketManager";
import { ConnectionState } from "../types/connectionState";
import type { ConnectionConfig } from "../types/connectionState";
// WebRTC Mesh is managed at the Room level via useWebRTCVoice.
// Avoid importing useWebRTCMesh here to prevent duplicate voice systems.
import { useRoomAudio } from "./useRoomAudio";
import type { SynthState } from "@/features/instruments";
import { useRoomStore } from "@/features/rooms";
import { useUserStore } from "@/shared/stores/userStore";
import { throttle } from "lodash";
import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";

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

// Deprecated in this hook: VoiceUser (handled by Room-level WebRTC hook)

/**
 * New socket hook using the RoomSocketManager for namespace-based connections
 * Replaces the old useSocket hook with connection pool logic
 * Includes WebRTC auto-connection system - Requirements: 5.1, 5.2, 5.3, 5.4
 * Includes room audio management - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
 */
export const useRoomSocket = (instrumentManager?: any) => {
  // Socket manager instance
  const socketManagerRef = useRef<RoomSocketManager | null>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED,
  );
  const [connectionConfig, setConnectionConfig] =
    useState<ConnectionConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already joined the current room to prevent loops
  const joinedRoomRef = useRef<string | null>(null);

  // Callback refs for event handlers
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
  const autoSendSynthParamsToNewUserCallbackRef = useRef<
    | ((data: { newUserId: string; newUsername: string }) => void)
    | null
  >(null);
  const sendCurrentSynthParamsToNewUserCallbackRef = useRef<
    | ((data: { newUserId: string; newUsername: string }) => void)
    | null
  >(null);
  const requestCurrentSynthParamsForNewUserCallbackRef = useRef<
    | ((data: { newUserId: string; newUsername: string; synthUserId: string; synthUsername: string }) => void)
    | null
  >(null);
  const sendSynthParamsToNewUserNowCallbackRef = useRef<
    | ((data: { newUserId: string; newUsername: string; synthUserId: string; synthUsername: string }) => void)
    | null
  >(null);
  const guestCancelledCallbackRef = useRef<((userId: string) => void) | null>(
    null,
  );
  const memberRejectedCallbackRef = useRef<((userId: string) => void) | null>(
    null,
  );
  // Stable ref to call joinRoom from early effects without creating a dep cycle
  const joinRoomRef = useRef<
    | ((
        roomId: string,
        username: string,
        userId: string,
        role: "band_member" | "audience",
      ) => void)
    | null
  >(null);

  // Performance optimizations
  const messageQueueRef = useRef<
    Array<{ event: string; data: any; timestamp: number }>
  >([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BATCH_INTERVAL = 8;
  const MAX_QUEUE_SIZE = 100;

  // Deduplication for note events
  const recentNoteEvents = useRef<Map<string, number>>(new Map());
  const NOTE_DEDUPE_WINDOW = 20;

  // Pending operations for when socket connects
  const pendingOperationsRef = useRef<Array<() => void>>([]);

  // Room store actions
  const {
    setCurrentRoom,
    setCurrentUser,
    setIsConnected,
    setPendingApproval,
    setError: setRoomError,
    addUser,
    removeUser,
    addPendingMember,
    removePendingMember,
    updateUserInstrument,
    transferOwnership,
    clearRoom,
  } = useRoomStore();

  // Initialize socket manager
  useEffect(() => {
    const backendUrl =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
    socketManagerRef.current = new RoomSocketManager(backendUrl);

    // Set up state change handler
    const unsubscribeStateChange = socketManagerRef.current.onStateChange(
      (state, config) => {
        setConnectionState(state);
        setConnectionConfig(config);
        setIsConnected(state === ConnectionState.IN_ROOM);

        if (state === ConnectionState.REQUESTING) {
          setPendingApproval(true);
        } else {
          setPendingApproval(false);
        }

        // Auto-join room when connected to room namespace (only once per room)
        if (
          state === ConnectionState.IN_ROOM &&
          config?.roomId &&
          joinedRoomRef.current !== config.roomId
        ) {
          const userId = useUserStore.getState().userId;
          const username = useUserStore.getState().username;
          if (userId && username) {
            console.log(
              "🚪 Auto-joining room after state change to IN_ROOM:",
              config.roomId,
            );
            joinedRoomRef.current = config.roomId;
            // Use ref to avoid effect dependency on joinRoom
            joinRoomRef.current?.(
              config.roomId,
              username,
              userId,
              config.role || "audience",
            );
          }
        }

        // Reset joined room ref when leaving room
        if (state !== ConnectionState.IN_ROOM) {
          joinedRoomRef.current = null;
        }
      },
    );

    // Set up error handler
    const unsubscribeError = socketManagerRef.current.onError((errorMsg) => {
      setError(errorMsg);
      setRoomError(errorMsg);
    });

    // Set up reconnection handler
    // Requirements: 5.7 - WebRTC mesh restoration after page refresh or reconnection
    const unsubscribeReconnection = socketManagerRef.current.onReconnection(
      () => {
        

        // WebRTC reconnection is handled by useWebRTCVoice in Room.tsx

        // Restore instrument state if available
        const storedInstrumentState =
          socketManagerRef.current?.getStoredInstrumentState();
        if (storedInstrumentState && instrumentManager) {
          
          // The instrument restoration will be handled by the useRoom hook
        }
      },
    );

    return () => {
      unsubscribeStateChange();
      unsubscribeError();
      unsubscribeReconnection();
      socketManagerRef.current?.disconnect();
    };
    // joinRoom is declared later; auto-join is guarded by state and refs.
  }, [setIsConnected, setPendingApproval, setRoomError, instrumentManager]);

  // Get active socket
  const getActiveSocket = useCallback((): Socket | null => {
    return socketManagerRef.current?.getActiveSocket() || null;
  }, []);

  // Room audio management - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
  const roomAudio = useRoomAudio({
    connectionState,
    instrumentManager,
  });

  // WebRTC is handled separately by useWebRTCVoice in Room.tsx

  // Batch message processing
  const processMessageBatch = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    const messages = [...messageQueueRef.current];
    messageQueueRef.current = [];

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

    Object.entries(groupedMessages).forEach(([key, dataArray]) => {
      const socket = getActiveSocket();
      if (socket?.connected) {
        const latestData = dataArray[dataArray.length - 1];
        socket.emit(key.split("-")[0], latestData);
      }
    });

    batchTimeoutRef.current = null;
  }, [getActiveSocket]);

  // Queue message for batched processing
  const queueMessage = useCallback(
    (event: string, data: any) => {
      messageQueueRef.current.push({ event, data, timestamp: Date.now() });

      if (messageQueueRef.current.length > MAX_QUEUE_SIZE) {
        messageQueueRef.current = messageQueueRef.current.slice(
          -MAX_QUEUE_SIZE / 2,
        );
      }

      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(
          processMessageBatch,
          BATCH_INTERVAL,
        );
      }
    },
    [processMessageBatch],
  );

  // Execute pending operations when socket connects
  const executePendingOperations = useCallback(() => {
    while (pendingOperationsRef.current.length > 0) {
      const operation = pendingOperationsRef.current.shift();
      if (operation) {
        operation();
      }
    }
  }, []);

  // Safe emit function
  const safeEmit = useCallback(
    (event: string, data: any) => {
      const socket = getActiveSocket();
      if (socket?.connected) {
        // Critical events that need immediate emission
        if (
          event === "play_note" ||
          event === "change_instrument" ||
          event === "join_room" ||
          event === "leave_room" ||
          event === "update_synth_params"
        ) {
          
          socket.emit(event, data);
        } else {
          
          queueMessage(event, data);
        }
      } else {
        
        pendingOperationsRef.current.push(() => {
          const currentSocket = getActiveSocket();
          if (currentSocket?.connected) {
            
            currentSocket.emit(event, data);
          }
        });
      }
    },
    [getActiveSocket, queueMessage],
  );

  // Throttled emit for synth parameters (10ms for realtime responsiveness)
  const throttledEmit = useMemo(
    () =>
      throttle((event: string, data: any) => {
        
        safeEmit(event, data);
      }, 10),
    [safeEmit],
  );

  // Set up room event handlers when socket changes
  useEffect(() => {
    const socket = getActiveSocket();
    if (!socket) {
      return;
    }

    // Track only handlers registered by this hook so we don't remove listeners from other hooks (e.g., usePingMeasurement)
    const registrations: Array<[string, (...args: any[]) => void]> = [];
    const on = (event: string, handler: (...args: any[]) => void) => {
      socket.on(event, handler);
      registrations.push([event, handler]);
    };

    // Set up common event handlers for all connection states
    const handleConnect = () => {
      setIsConnecting(false);
      setError(null);
      executePendingOperations();
    };
    on("connect", handleConnect);

    const handleDisconnect = () => {
      setIsConnecting(false);
      setError("Connection lost");
    };
    on("disconnect", handleDisconnect);

    const handleConnectError = (error: any) => {
      console.error("Connection error:", error);
      setIsConnecting(false);
      setError("Failed to connect to server");
    };
    on("connect_error", handleConnectError);

    const handleErrorEvent = (data: { message: string }) => {
      console.error("Socket error:", data.message);
      setError(data.message);
    };
    on("error", handleErrorEvent);

    // Set up state-specific event handlers
    if (connectionState === ConnectionState.LOBBY) {
      // No-op: ping listeners are owned by usePingMeasurement; avoid attaching/removing here.
    } else if (connectionState === ConnectionState.REQUESTING) {
      // Approval-specific handlers are already set up in RoomSocketManager
    } else if (connectionState === ConnectionState.IN_ROOM) {
      // Room-specific event handlers
      on("room_created", (data: { room: any; user: any }) => {
        setCurrentRoom(data.room);
        setCurrentUser(data.user);
        setError(null);
      });

      on("room_created_broadcast", (data: any) => {
        if (roomCreatedCallbackRef.current) {
          roomCreatedCallbackRef.current(data);
        }
      });

      on(
        "room_joined",
        async (data: { room: any; users: any[]; pendingMembers: any[] }) => {
          setCurrentRoom({
            ...data.room,
            users: data.users,
            pendingMembers: data.pendingMembers,
          });

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

          // Initialize audio context and preload instruments after successful room join - Requirements: 10.1, 10.2
          try {
            console.log(
              "🎵 Initializing audio context and preloading instruments for room join",
            );
            await roomAudio.initializeForRoom(data.users);
            console.log(
              "✅ Audio context initialized and instruments preloaded successfully",
            );
          } catch (error) {
            console.error("❌ Failed to initialize audio for room:", error);
            // Don't block room join on audio initialization failure
          }

          // WebRTC initialization is handled by useWebRTCVoice in Room.tsx
        },
      );

      on("user_joined", async (data: { user: any }) => {
        
        
        addUser(data.user);

        // Preload the new user's instrument if they have one
        if (data.user.currentInstrument && data.user.currentCategory) {
          try {
            console.log(
              `🎵 Preloading instrument for new user: ${data.user.username} - ${data.user.currentInstrument} (${data.user.currentCategory})`,
            );
            await roomAudio.handleUserInstrumentChange(
              data.user.id,
              data.user.username,
              data.user.currentInstrument,
              data.user.currentCategory,
            );
            console.log(
              `✅ Successfully preloaded instrument ${data.user.currentInstrument} for new user ${data.user.username}`,
            );
          } catch (error) {
            console.error(
              `❌ Failed to preload instrument for new user ${data.user.username}:`,
              error,
            );
          }
        } else {
          console.log(
            `⚠️ New user ${data.user.username} has no instrument info:`,
            data.user,
          );
        }
      });

      on("user_left", (data: { user: any }) => {
        removeUser(data.user.id);
        // Clean up audio resources for the user who left - Requirement 10.4
        roomAudio.handleUserLeft(data.user.id);
        if (userLeftCallbackRef.current) {
          userLeftCallbackRef.current(data.user);
        }
      });

      on("member_request", (data: { user: any }) => {
        addPendingMember(data.user);
      });

      // New: handle approval requests for private rooms (owner notification)
      on("approval_request", (data: { user: any; requestedAt?: string }) => {
        addPendingMember(data.user);
      });

      on("member_approved", (data: { user?: any; room?: any }) => {
        if (data.user) {
          removePendingMember(data.user.id);
          addUser(data.user);
        }
        if (data.room) {
          setCurrentRoom(data.room);
          setPendingApproval(false);

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

      on("room_state_updated", (data: { room: any }) => {
        setCurrentRoom(data.room);
      });

      on("member_rejected", (data: { message: string; userId?: string }) => {
        setPendingApproval(false);
        clearRoom();
        setError("Your request to join was rejected by the room owner");

        if (memberRejectedCallbackRef.current && data.userId) {
          memberRejectedCallbackRef.current(data.userId);
        }
      });

      on("ownership_transferred", (data: { newOwner: any; oldOwner: any }) => {
        transferOwnership(data.newOwner.id);

        const currentUserId = useUserStore.getState().userId;
        if (
          currentUserId &&
          data.oldOwner &&
          currentUserId === data.oldOwner.id
        ) {
          clearRoom();
          socketManagerRef.current?.disconnect();
          try {
            window.location.href = "/";
          } catch {
            window.location.assign("/");
          }
        }
      });

      on("room_closed", (data: { message: string }) => {
        setError(data.message);
        clearRoom();
      });

      on("room_closed_broadcast", (data: { roomId: string }) => {
        if (roomClosedCallbackRef.current) {
          roomClosedCallbackRef.current(data.roomId);
        }
        clearRoom();
      });

      on("leave_confirmed", () => {
        clearRoom();
      });

      // Musical event handlers (room namespace only)
      // Note: note_played events are handled by the onNoteReceived callback system

      on(
        "instrument_changed",
        async (data: {
          userId: string;
          username: string;
          instrument: string;
          category: string;
        }) => {
          
          updateUserInstrument(data.userId, data.instrument, data.category);
          // Handle real-time instrument preloading - Requirement 10.3
          try {
            console.log(
              `🎵 Preloading instrument via socket handler: ${data.instrument} for ${data.username}`,
            );
            await roomAudio.handleUserInstrumentChange(
              data.userId,
              data.username,
              data.instrument,
              data.category,
            );
            console.log(
              `✅ Successfully preloaded via socket handler: ${data.instrument} for ${data.username}`,
            );
          } catch (error) {
            console.error("❌ Failed to preload instrument for user:", error);
            // Don't block the instrument change on preload failure
          }
          if (instrumentChangedCallbackRef.current) {
            console.log(
              "🎵 Calling instrumentChangedCallback with data:",
              data,
            );
            instrumentChangedCallbackRef.current(data);
          } else {
            console.log("🔧 No instrument changed callback set");
          }
        },
      );

      on("synth_params_changed", (data: SynthParamsData) => {
        if (synthParamsChangedCallbackRef.current) {
          synthParamsChangedCallbackRef.current(data);
        }
      });

      on(
        "request_synth_params_response",
        (data: { requestingUserId: string; requestingUsername: string }) => {
          if (requestSynthParamsResponseCallbackRef.current) {
            requestSynthParamsResponseCallbackRef.current(data);
          }
        },
      );

      on(
        "auto_send_synth_params_to_new_user",
        (data: { newUserId: string; newUsername: string }) => {
          
          if (autoSendSynthParamsToNewUserCallbackRef.current) {
            autoSendSynthParamsToNewUserCallbackRef.current(data);
          } else {
            console.log("🔧 No autoSendSynthParamsToNewUser callback set");
          }
        },
      );

      on(
        "send_current_synth_params_to_new_user",
        (data: { newUserId: string; newUsername: string }) => {
          
          if (sendCurrentSynthParamsToNewUserCallbackRef.current) {
            sendCurrentSynthParamsToNewUserCallbackRef.current(data);
          } else {
            console.log("🔧 No sendCurrentSynthParamsToNewUser callback set");
          }
        },
      );

      on(
        "request_current_synth_params_for_new_user",
        (data: { newUserId: string; newUsername: string; synthUserId: string; synthUsername: string }) => {
          
          if (requestCurrentSynthParamsForNewUserCallbackRef.current) {
            requestCurrentSynthParamsForNewUserCallbackRef.current(data);
          } else {
            console.log("🔧 No requestCurrentSynthParamsForNewUser callback set");
          }
        },
      );

      on(
        "send_synth_params_to_new_user_now",
        (data: { newUserId: string; newUsername: string; synthUserId: string; synthUsername: string }) => {
          
          if (sendSynthParamsToNewUserNowCallbackRef.current) {
            sendSynthParamsToNewUserNowCallbackRef.current(data);
          } else {
            console.log("🔧 No sendSynthParamsToNewUserNow callback set");
          }
        },
      );

      // Metronome event handlers (room namespace only)
      on("metronome_updated", () => {
        // This will be handled by metronome hooks
      });
      on("metronome_tick", () => {
        // This will be handled by metronome hooks
      });
      on("metronome_state", () => {
        // This will be handled by metronome hooks
      });

      // Voice/WebRTC event handlers (room namespace only)
      on("voice_offer", () => {});
      on("voice_answer", () => {});
      on("voice_ice_candidate", () => {});
      on("user_joined_voice", () => {});
      on("user_left_voice", () => {});
      on("voice_mute_changed", () => {});
      on("voice_participants", () => {});
      on("request_voice_participants", () => {});
      on("request_mesh_connections", () => {});
      on("voice_heartbeat", () => {});

      // Chat message handler (room namespace only)
      on("chat_message", (data: any) => {
        if ((window as any).handleChatMessage) {
          (window as any).handleChatMessage(data);
        }
      });

      // Handle approval request cancellations (for room owners)
      on(
        "approval_request_cancelled",
        (data: { userId: string; message: string }) => {
          removePendingMember(data.userId);
          if (guestCancelledCallbackRef.current) {
            guestCancelledCallbackRef.current(data.userId);
          }
        },
      );
    }

    return () => {
      // Clean up only the listeners we registered, preserve others (e.g., ping listeners)
      registrations.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [
    connectionState,
    getActiveSocket,
    setCurrentRoom,
    setCurrentUser,
    setError,
    addUser,
    removeUser,
    addPendingMember,
    removePendingMember,
    updateUserInstrument,
    transferOwnership,
    clearRoom,
    setPendingApproval,
    executePendingOperations,
    setIsConnecting,
    roomAudio,
  ]);

  // Connection methods
  const connectToLobby = useCallback(async () => {
    if (!socketManagerRef.current) return;
    setIsConnecting(true);
    try {
      await socketManagerRef.current.connectToLobby();
    } catch (error) {
      setError(`Failed to connect to lobby: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectToRoom = useCallback(
    async (roomId: string, role: "band_member" | "audience") => {
      if (!socketManagerRef.current) return;
      setIsConnecting(true);
      try {
        // Get user info for session storage
        const userId = useUserStore.getState().userId;
        const username = useUserStore.getState().username;

        await socketManagerRef.current.connectToRoom(
          roomId,
          role,
          userId || undefined,
          username || undefined,
        );
      } catch (error) {
        setError(`Failed to connect to room: ${error}`);
      } finally {
        setIsConnecting(false);
      }
    },
    [],
  );

  const requestRoomApproval = useCallback(
    async (
      roomId: string,
      userId: string,
      username: string,
      role: "band_member" | "audience",
    ) => {
      if (!socketManagerRef.current) return;
      setIsConnecting(true);
      try {
        await socketManagerRef.current.connectToApproval(
          roomId,
          userId,
          username,
          role,
        );
      } catch (error) {
        setError(`Failed to request approval: ${error}`);
      } finally {
        setIsConnecting(false);
      }
    },
    [],
  );

  const cancelApprovalRequest = useCallback(async () => {
    if (!socketManagerRef.current) return;
    try {
      await socketManagerRef.current.cancelApprovalRequest();
    } catch (error) {
      setError(`Failed to cancel approval request: ${error}`);
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    if (!socketManagerRef.current) return;
    try {
      await socketManagerRef.current.leaveRoom();
    } catch (error) {
      setError(`Failed to leave room: ${error}`);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!socketManagerRef.current) return;
    try {
      await socketManagerRef.current.disconnect();
    } catch (error) {
      setError(`Failed to disconnect: ${error}`);
    }
  }, []);

  // Room actions (only work when in room)
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

  const joinRoom = useCallback(
    (
      roomId: string,
      username: string,
      userId: string,
      role: "band_member" | "audience",
    ) => {
      // Basic client-side validation + debug to avoid server-side validation loops
      // Accept any RFC 4122 UUID (v1-v5) to match backend Joi.uuid()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          roomId,
        );
      if (!isUuid) {
        console.warn("join_room aborted: roomId is not a valid UUID v4", {
          roomId,
        });
        setError("Invalid room identifier. Please return to lobby.");
        return;
      }
      if (!username || !userId) {
        console.warn("join_room aborted: missing username/userId", {
          username,
          userId,
        });
        setError("Missing user info. Please set your username again.");
        return;
      }
      if (role !== "band_member" && role !== "audience") {
        console.warn("join_room aborted: invalid role", { role });
        setError(
          "Invalid role. Please try joining as audience or band member.",
        );
        return;
      }
      
      safeEmit("join_room", { roomId, username, userId, role });
    },
    [safeEmit, setError],
  );

  // Keep the ref updated with the latest joinRoom
  useEffect(() => {
    joinRoomRef.current = joinRoom;
  }, [joinRoom]);

  const approveMember = useCallback(
    (userId: string) => {
      safeEmit("approve_member", { userId });
    },
    [safeEmit],
  );

  const rejectMember = useCallback(
    (userId: string) => {
      safeEmit("reject_member", { userId });
    },
    [safeEmit],
  );

  const transferOwnershipTo = useCallback(
    (newOwnerId: string) => {
      safeEmit("transfer_ownership", { newOwnerId });
    },
    [safeEmit],
  );

  // Musical actions
  const playNote = useCallback(
    (data: NoteData) => {
      // Safety check: ensure notes is an array
      if (!Array.isArray(data.notes)) {
        console.error(
          "playNote received non-array notes:",
          data.notes,
          "Full data:",
          data,
        );
        return;
      }

      const isMonoSynth =
        data.instrument === "analog_mono" || data.instrument === "fm_mono";
      const isDrumMachine = data.category === "DrumBeat";

      const eventKey = `${data.eventType}-${data.notes.join(",")}-${data.instrument}-${data.velocity}`;
      const now = Date.now();

      let dedupeWindow = NOTE_DEDUPE_WINDOW;
      let shouldCheckDuplicate = true;

      if (isDrumMachine) {
        dedupeWindow = 10;
        shouldCheckDuplicate = data.eventType === "note_on";
      } else if (isMonoSynth) {
        shouldCheckDuplicate = data.eventType === "note_on";
      }

      if (shouldCheckDuplicate) {
        const lastSent = recentNoteEvents.current.get(eventKey);
        if (lastSent && now - lastSent < dedupeWindow) {
          return;
        }
      }

      recentNoteEvents.current.set(eventKey, now);
      safeEmit("play_note", data);

      if (recentNoteEvents.current.size > 200) {
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

  const changeInstrument = useCallback(
    (instrument: string, category: string) => {
      safeEmit("change_instrument", { instrument, category });
    },
    [safeEmit],
  );

  const stopAllNotes = useCallback(
    (instrument: string, category: string) => {
      safeEmit("stop_all_notes", { instrument, category });
    },
    [safeEmit],
  );

  const updateSynthParams = useCallback(
    (params: Partial<SynthState>) => {
      
      const socket = getActiveSocket();
      console.log("🎛️ Current socket state:", {
        socket: !!socket,
        connected: socket?.connected,
        id: socket?.id,
      });
      
      throttledEmit("update_synth_params", { params });
    },
    [throttledEmit, getActiveSocket],
  );

  const requestSynthParams = useCallback(() => {
    safeEmit("request_synth_params", {});
  }, [safeEmit]);

  const sendChatMessage = useCallback(
    (message: string, roomId: string) => {
      safeEmit("chat_message", { message, roomId });
    },
    [safeEmit],
  );

  // Instrument swap functions
  const requestInstrumentSwap = useCallback(
    (targetUserId: string) => {
      safeEmit("request_instrument_swap", { targetUserId });
    },
    [safeEmit],
  );

  const approveInstrumentSwap = useCallback(
    (requesterId: string) => {
      safeEmit("approve_instrument_swap", { requesterId });
    },
    [safeEmit],
  );

  const rejectInstrumentSwap = useCallback(
    (requesterId: string) => {
      safeEmit("reject_instrument_swap", { requesterId });
    },
    [safeEmit],
  );

  const cancelInstrumentSwap = useCallback(() => {
    safeEmit("cancel_instrument_swap", {});
  }, [safeEmit]);

  // Sequencer snapshot exchange
  const requestSequencerState = useCallback(
    (targetUserId: string) => {
      safeEmit("request_sequencer_state", { targetUserId });
    },
    [safeEmit],
  );

  const sendSequencerState = useCallback(
    (targetUserId: string, snapshot: { banks: any; settings: any; currentBank: string }) => {
      safeEmit("send_sequencer_state", { targetUserId, snapshot });
    },
    [safeEmit],
  );

  const onSequencerStateRequested = useCallback(
    (callback: (data: { requesterId: string }) => void) => {
      const socket = getActiveSocket();
      if (!socket) return () => {};
      const handler = (data: { requesterId: string }) => callback(data);
      socket.on("sequencer_state_requested", handler);
      return () => socket.off("sequencer_state_requested", handler);
    },
    [getActiveSocket],
  );

  const onSequencerStateReceived = useCallback(
    (callback: (data: { fromUserId: string; snapshot: { banks: any; settings: any; currentBank: string } }) => void) => {
      const socket = getActiveSocket();
      if (!socket) return () => {};
      const handler = (data: { fromUserId: string; snapshot: { banks: any; settings: any; currentBank: string } }) => callback(data);
      socket.on("sequencer_state", handler);
      return () => socket.off("sequencer_state", handler);
    },
    [getActiveSocket],
  );

  // Kick user function
  const kickUser = useCallback(
    (targetUserId: string) => {
      safeEmit("kick_user", { targetUserId });
    },
    [safeEmit],
  );

  // Scale follow functions
  const changeRoomOwnerScale = useCallback(
    (rootNote: string, scale: import('../../../shared/types').Scale) => {
      safeEmit("room_owner_scale_change", { rootNote, scale });
    },
    [safeEmit],
  );

  const toggleFollowRoomOwner = useCallback(
    (followRoomOwner: boolean) => {
      safeEmit("toggle_follow_room_owner", { followRoomOwner });
    },
    [safeEmit],
  );

  // Event handler setters
  const onNoteReceived = useCallback(
    (callback: (data: NoteReceivedData) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      

      const handleNoteReceived = (data: NoteReceivedData) => {
        
        callback(data);
      };

      socket.on("note_played", handleNoteReceived);

      return () => {
        
        socket.off("note_played", handleNoteReceived);
      };
    },
    [getActiveSocket],
  );

  const onRoomCreated = useCallback((callback: (room: any) => void) => {
    roomCreatedCallbackRef.current = callback;
  }, []);

  const onRoomClosed = useCallback((callback: (roomId: string) => void) => {
    roomClosedCallbackRef.current = callback;
  }, []);

  const onUserLeft = useCallback((callback: (user: any) => void) => {
    userLeftCallbackRef.current = callback;
  }, []);

  const onInstrumentChanged = useCallback(
    (
      callback: (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => void,
    ) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      console.log(
        "🔧 Setting up instrument_changed listener on socket:",
        socket.id,
      );

      const handleInstrumentChanged = (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => {
        
        callback(data);
      };

      socket.on("instrument_changed", handleInstrumentChanged);

      return () => {
        
        socket.off("instrument_changed", handleInstrumentChanged);
      };
    },
    [getActiveSocket],
  );

  const onStopAllNotes = useCallback(
    (
      callback: (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => void,
    ) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      console.log(
        "🔧 Setting up stop_all_notes listener on socket:",
        socket.id,
      );

      const handleStopAllNotes = (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => {
        
        callback(data);
      };

      socket.on("stop_all_notes", handleStopAllNotes);

      return () => {
        
        socket.off("stop_all_notes", handleStopAllNotes);
      };
    },
    [getActiveSocket],
  );

  const onSynthParamsChanged = useCallback(
    (callback: (data: SynthParamsData) => void) => {
      synthParamsChangedCallbackRef.current = callback;
    },
    [],
  );

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

  const onAutoSendSynthParamsToNewUser = useCallback(
    (
      callback: (data: {
        newUserId: string;
        newUsername: string;
      }) => void,
    ) => {
      autoSendSynthParamsToNewUserCallbackRef.current = callback;
    },
    [],
  );

  const onSendCurrentSynthParamsToNewUser = useCallback(
    (
      callback: (data: {
        newUserId: string;
        newUsername: string;
      }) => void,
    ) => {
      sendCurrentSynthParamsToNewUserCallbackRef.current = callback;
    },
    [],
  );

  const onRequestCurrentSynthParamsForNewUser = useCallback(
    (
      callback: (data: {
        newUserId: string;
        newUsername: string;
        synthUserId: string;
        synthUsername: string;
      }) => void,
    ) => {
      requestCurrentSynthParamsForNewUserCallbackRef.current = callback;
    },
    [],
  );

  const onSendSynthParamsToNewUserNow = useCallback(
    (
      callback: (data: {
        newUserId: string;
        newUsername: string;
        synthUserId: string;
        synthUsername: string;
      }) => void,
    ) => {
      sendSynthParamsToNewUserNowCallbackRef.current = callback;
    },
    [],
  );

  const onGuestCancelled = useCallback((callback: (userId: string) => void) => {
    guestCancelledCallbackRef.current = callback;
  }, []);

  const onMemberRejected = useCallback((callback: (userId: string) => void) => {
    memberRejectedCallbackRef.current = callback;
  }, []);

  // Instrument swap event handlers
  const onSwapRequestReceived = useCallback(
    (callback: (data: { requesterId: string; requesterUsername: string }) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapRequest = (data: { requesterId: string; requesterUsername: string }) => {
        
        callback(data);
      };

      socket.on("swap_request_received", handleSwapRequest);

      return () => {
        socket.off("swap_request_received", handleSwapRequest);
      };
    },
    [getActiveSocket],
  );

  const onSwapRequestSent = useCallback(
    (callback: (data: { targetUserId: string }) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapRequestSent = (data: { targetUserId: string }) => {
        
        callback(data);
      };

      socket.on("swap_request_sent", handleSwapRequestSent);

      return () => {
        socket.off("swap_request_sent", handleSwapRequestSent);
      };
    },
    [getActiveSocket],
  );

  const onSwapApproved = useCallback(
    (callback: (data: any) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapApproved = (data: any) => {
        
        callback(data);
      };

      socket.on("swap_approved", handleSwapApproved);

      return () => {
        socket.off("swap_approved", handleSwapApproved);
      };
    },
    [getActiveSocket],
  );

  const onSwapRejected = useCallback(
    (callback: () => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapRejected = () => {
        
        callback();
      };

      socket.on("swap_rejected", handleSwapRejected);

      return () => {
        socket.off("swap_rejected", handleSwapRejected);
      };
    },
    [getActiveSocket],
  );

  const onSwapCancelled = useCallback(
    (callback: () => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapCancelled = () => {
        
        callback();
      };

      socket.on("swap_cancelled", handleSwapCancelled);

      return () => {
        socket.off("swap_cancelled", handleSwapCancelled);
      };
    },
    [getActiveSocket],
  );

  const onSwapCompleted = useCallback(
    (callback: (data: any) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleSwapCompleted = (data: any) => {
        
        callback(data);
      };

      socket.on("swap_completed", handleSwapCompleted);

      return () => {
        socket.off("swap_completed", handleSwapCompleted);
      };
    },
    [getActiveSocket],
  );

  const onUserKicked = useCallback(
    (callback: (data: { reason: string }) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        
        return () => {};
      }

      const handleUserKicked = (data: { reason: string }) => {
        
        callback(data);
      };

      socket.on("user_kicked", handleUserKicked);

      return () => {
        socket.off("user_kicked", handleUserKicked);
      };
    },
    [getActiveSocket],
  );

  // Scale follow event handlers
  const onRoomOwnerScaleChanged = useCallback(
    (callback: (data: import('../../../shared/types').RoomOwnerScaleChangedEvent) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        console.log("🔧 No active socket for onRoomOwnerScaleChanged");
        return () => {};
      }

      console.log("🎵 Setting up room_owner_scale_changed listener on socket:", socket.id);

      const handleRoomOwnerScaleChanged = (data: import('../../../shared/types').RoomOwnerScaleChangedEvent) => {
        console.log("🎵 Room owner scale changed:", data);
        callback(data);
      };

      socket.on("room_owner_scale_changed", handleRoomOwnerScaleChanged);

      return () => {
        console.log("🔧 Cleaning up room_owner_scale_changed listener");
        socket.off("room_owner_scale_changed", handleRoomOwnerScaleChanged);
      };
    },
    [getActiveSocket],
  );

  const onFollowRoomOwnerToggled = useCallback(
    (callback: (data: import('../../../shared/types').FollowRoomOwnerToggledEvent) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        console.log("🔧 No active socket for onFollowRoomOwnerToggled");
        return () => {};
      }

      console.log("🎵 Setting up follow_room_owner_toggled listener on socket:", socket.id);

      const handleFollowRoomOwnerToggled = (data: import('../../../shared/types').FollowRoomOwnerToggledEvent) => {
        console.log("🎵 Follow room owner toggled:", data);
        callback(data);
      };

      socket.on("follow_room_owner_toggled", handleFollowRoomOwnerToggled);

      return () => {
        console.log("🔧 Cleaning up follow_room_owner_toggled listener");
        socket.off("follow_room_owner_toggled", handleFollowRoomOwnerToggled);
      };
    },
    [getActiveSocket],
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    if (messageQueueRef.current.length > 0) {
      processMessageBatch();
    }

    recentNoteEvents.current.clear();
  }, [processMessageBatch]);

  return {
    // Connection state
    connectionState,
    connectionConfig,
    isConnected: connectionState === ConnectionState.IN_ROOM,
    isConnecting,
    error,

    // Connection methods
    connectToLobby,
    connectToRoom,
    requestRoomApproval,
    cancelApprovalRequest,
    leaveRoom,
    disconnect,

    // Room actions
    createRoom,
    joinRoom,
    approveMember,
    rejectMember,
    transferOwnershipTo,

    // Musical actions
    playNote,
    changeInstrument,
    updateSynthParams,
    requestSynthParams,
    sendChatMessage,
    stopAllNotes,

    // Instrument swap actions
    requestInstrumentSwap,
    approveInstrumentSwap,
    rejectInstrumentSwap,
    cancelInstrumentSwap,
    requestSequencerState,
    sendSequencerState,
    onSequencerStateRequested,
    onSequencerStateReceived,
    kickUser,

    // Event handlers
    onNoteReceived,
    onRoomCreated,
    onRoomClosed,
    onUserLeft,
    onInstrumentChanged,
    onStopAllNotes,
    onSynthParamsChanged,
    onRequestSynthParamsResponse,
    onAutoSendSynthParamsToNewUser,
    onSendCurrentSynthParamsToNewUser,
    onRequestCurrentSynthParamsForNewUser,
    onSendSynthParamsToNewUserNow,
    onGuestCancelled,
    onMemberRejected,
    onSwapRequestReceived,
    onSwapRequestSent,
    onSwapApproved,
    onSwapRejected,
    onSwapCancelled,
    onSwapCompleted,
    onUserKicked,
    onRoomOwnerScaleChanged,
    onFollowRoomOwnerToggled,

    // Scale functions
    changeRoomOwnerScale,
    toggleFollowRoomOwner,

    // Utilities
    getActiveSocket,
    cleanup,

    // WebRTC details are provided by the Room-level useWebRTCVoice hook

    // Room audio management - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
    roomAudio: {
      isAudioContextReady: roomAudio.isAudioContextReady,
      initializeForRoom: roomAudio.initializeForRoom,
      handleUserInstrumentChange: roomAudio.handleUserInstrumentChange,
      handleUserLeft: roomAudio.handleUserLeft,
      cleanup: roomAudio.cleanup,
    },
  };
};
