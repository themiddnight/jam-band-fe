import { RoomSocketManager } from "../services/RoomSocketManager";
import { ConnectionState } from "../types/connectionState";
import type { ConnectionConfig } from "../types/connectionState";
// WebRTC Mesh is managed at the Room level via useWebRTCVoice.
// Avoid importing useWebRTCMesh here to prevent duplicate voice systems.
import { useRoomAudio } from "./useRoomAudio";
import type { SynthState } from "@/features/instruments";
import { useRoomStore } from "@/features/rooms";
import { EffectsService } from "@/features/effects/services/effectsService";
import type {
  EffectChain as UiEffectChain,
  EffectChainType as UiEffectChainType,
} from "@/features/effects/types";
import type {
  EffectChainState,
  EffectChainType as SharedEffectChainType,
} from "@/shared/types";
import { SocketMessageQueue } from "@/shared/utils/SocketMessageQueue";
import { UserService } from "@/shared/services/userService";
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
  sampleNotes?: string[];
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
  sampleNotes?: string[];
}

export interface SynthParamsData {
  userId: string;
  username: string;
  instrument: string;
  category: string;
  params: Partial<SynthState>;
}

export interface NewUserSynthParamsData {
  newUserId: string;
  newUsername: string;
  synthUserId: string;
  synthUsername: string;
}

export interface RequestSynthParamsResponseData {
  requestingUserId: string;
  requestingUsername: string;
}

export interface AutoSendSynthParamsData {
  newUserId: string;
  newUsername: string;
}

interface EffectsChainChangedData {
  userId: string;
  username: string;
  chains: Record<SharedEffectChainType, EffectChainState>;
}

const serializeChainsForNetwork = (
  chains: Record<UiEffectChainType, UiEffectChain>,
): Record<SharedEffectChainType, EffectChainState> => {
  const result: Partial<Record<SharedEffectChainType, EffectChainState>> = {};

  (Object.entries(chains) as Array<[
    UiEffectChainType,
    UiEffectChain
  ]>).forEach(([chainType, chain]) => {
    result[chainType as SharedEffectChainType] = {
      type: chain.type as SharedEffectChainType,
      effects: chain.effects
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((effect) => ({
          id: effect.id,
          type: effect.type,
          name: effect.name,
          bypassed: effect.bypassed,
          order: effect.order,
          parameters: effect.parameters.map((param) => ({
            id: param.id,
            name: param.name,
            value: param.value,
            min: param.min,
            max: param.max,
            step: param.step,
            unit: param.unit,
            curve: param.curve,
          })),
        })),
    };
  });

  return result as Record<SharedEffectChainType, EffectChainState>;
};

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

  // Get active socket
  const getActiveSocket = useCallback((): Socket | null => {
    return socketManagerRef.current?.getActiveSocket() || null;
  }, []);

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
  const roomUpdatedCallbackRef = useRef<((room: any) => void) | null>(null);
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
    | ((data: RequestSynthParamsResponseData) => void)
    | null
  >(null);
  const autoSendSynthParamsToNewUserCallbackRef = useRef<
    | ((data: AutoSendSynthParamsData) => void)
    | null
  >(null);
  const sendCurrentSynthParamsToNewUserCallbackRef = useRef<
    | ((data: AutoSendSynthParamsData) => void)
    | null
  >(null);
  const requestCurrentSynthParamsForNewUserCallbackRef = useRef<
    | ((data: NewUserSynthParamsData) => void)
    | null
  >(null);
  const sendSynthParamsToNewUserNowCallbackRef = useRef<
    | ((data: NewUserSynthParamsData) => void)
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
  const queueRef = useRef<SocketMessageQueue | null>(null);
  
  // Initialize message queue
  useEffect(() => {
    queueRef.current = new SocketMessageQueue(getActiveSocket, {
      batchInterval: 8,
      maxQueueSize: 100
    });
    return () => queueRef.current?.clear();
  }, [getActiveSocket]);

  // Deduplication for note events
  const recentNoteEvents = useRef<Map<string, number>>(new Map());
  const NOTE_DEDUPE_WINDOW = 20;

  // Pending operations for when socket connects
  const pendingOperationsRef = useRef<Array<() => void>>([]);
  const skipNextEffectSyncRef = useRef(false);
  const lastEffectChainsSignatureRef = useRef<string | null>(null);

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
    updateUserEffectChains,
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
          const userId = UserService.getUserId();
          const username = UserService.getUsername();
          if (userId && username) {
            // console.log(
            //   "🚪 Auto-joining room after state change to IN_ROOM:",
            //   config.roomId,
            // );
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
        // console.log("🔄 Socket reconnected, handling reconnection...");

        // WebRTC reconnection is handled by useWebRTCVoice in Room.tsx

        // Restore instrument state if available
        const storedInstrumentState =
          socketManagerRef.current?.getStoredInstrumentState();
        if (storedInstrumentState && instrumentManager) {
          // console.log("🎵 Restoring instrument state after reconnection");
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


  // Room audio management - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
  const roomAudio = useRoomAudio({
    connectionState,
    instrumentManager,
  });

  // WebRTC is handled separately by useWebRTCVoice in Room.tsx

  // Queue message for batched processing
  const queueMessage = useCallback(
    (event: string, data: any) => {
      queueRef.current?.enqueue(event, data);
    },
    [],
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
          event === "update_synth_params" ||
          event === "update_effects_chain"
        ) {
          // console.log(`📤 Immediate emit: ${event}`);
          socket.emit(event, data);
        } else {
          // console.log(`📦 Queuing message: ${event}`);
          queueMessage(event, data);
        }
      } else {
        // console.log(`⏳ Socket not connected, queuing operation: ${event}`);
        pendingOperationsRef.current.push(() => {
          const currentSocket = getActiveSocket();
          if (currentSocket?.connected) {
            // console.log(`📤 Executing pending operation: ${event}`);
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
        // console.log(`🎛️ Throttled emit: ${event}`);
        safeEmit(event, data);
      }, 10),
    [safeEmit],
  );

  const throttledEffectsEmit = useMemo(
    () =>
      throttle(
        (data: { chains: Record<SharedEffectChainType, EffectChainState> }) => {
          safeEmit("update_effects_chain", data);
        },
        200,
        { leading: true, trailing: true },
      ),
    [safeEmit],
  );

  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) {
      return;
    }

    let isActive = true;

    const unsubscribe = EffectsService.subscribe((state) => {
      if (!isActive) return;

      const chains = state.chains as Record<UiEffectChainType, UiEffectChain>;
      const signature = JSON.stringify(chains);

      if (skipNextEffectSyncRef.current) {
        skipNextEffectSyncRef.current = false;
        lastEffectChainsSignatureRef.current = signature;
        return;
      }

      if (lastEffectChainsSignatureRef.current === signature) {
        return;
      }

      lastEffectChainsSignatureRef.current = signature;

      const payloadChains = serializeChainsForNetwork(chains);

      throttledEffectsEmit({ chains: payloadChains });

      const userId = UserService.getUserId();
      const username = UserService.getUsername();
      if (userId) {
        roomAudio
          .applyUserEffectChains(userId, payloadChains, username || undefined, {
            applyToMixer: false,
          })
          .catch((error: unknown) => {
            console.warn(
              "⚠️ Failed to update local effect chain metadata:",
              error,
            );
          });

        updateUserEffectChains(userId, payloadChains);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
      lastEffectChainsSignatureRef.current = null;
    };
  }, [
    connectionState,
    roomAudio,
    throttledEffectsEmit,
    updateUserEffectChains,
  ]);

  useEffect(() => () => throttledEffectsEmit.cancel(), [throttledEffectsEmit]);

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
        async (data: {
          room: any;
          users: any[];
          pendingMembers: any[];
          effectChains?: Record<SharedEffectChainType, EffectChainState>;
          self?: any;
        }) => {
          const normalizedUsers = data.users?.length
            ? data.users
            : data.room?.users ?? [];

          setCurrentRoom({
            ...data.room,
            users: normalizedUsers,
            pendingMembers: data.pendingMembers,
          });

          const currentUserId = UserService.getUserId();
          if (currentUserId) {
            const currentUserData =
              data.self && data.self.id === currentUserId
                ? data.self
                : normalizedUsers.find((user: any) => user.id === currentUserId);

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

          if (data.effectChains) {
            skipNextEffectSyncRef.current = true;
            EffectsService.setChainsFromState(data.effectChains);

            const currentUserId = UserService.getUserId();
            const currentUsername = UserService.getUsername();
            if (currentUserId) {
              await roomAudio.applyUserEffectChains(
                currentUserId,
                data.effectChains,
                currentUsername || undefined,
                { applyToMixer: false },
              );
              updateUserEffectChains(currentUserId, data.effectChains);
            }
          }

          // WebRTC initialization is handled by useWebRTCVoice in Room.tsx
        },
      );

      on("user_joined", async (data: { user: any }) => {
        // console.log("👤 User joined room:", data.user.username);
        // console.log("🎵 User instrument info:", data.user.currentInstrument, data.user.currentCategory);
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

        if (data.user.effectChains) {
          roomAudio
            .applyUserEffectChains(
              data.user.id,
              data.user.effectChains,
              data.user.username,
            )
            .catch((error: unknown) => {
              console.error(
                `❌ Failed to apply effect chains for new user ${data.user.username}:`,
                error,
              );
            });
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

          const currentUserId = UserService.getUserId();
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

        const currentUserId = UserService.getUserId();
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

      on("room_updated_broadcast", (data: any) => {
        if (roomUpdatedCallbackRef.current) {
          roomUpdatedCallbackRef.current(data);
        }
      });

      on("kicked", (data: { message: string }) => {
        setRoomError(data.message);
        clearRoom();
        socketManagerRef.current?.disconnect();
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
          // console.log("🎵 Instrument changed event received:", data);
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
            // console.log(
            //   "🎵 Calling instrumentChangedCallback with data:",
            //   data,
            // );
            instrumentChangedCallbackRef.current(data);
          } else {
            // console.log("🔧 No instrument changed callback set");
          }
        },
      );

      on("synth_params_changed", (data: SynthParamsData) => {
        if (synthParamsChangedCallbackRef.current) {
          synthParamsChangedCallbackRef.current(data);
        }
      });

      on(
        "effects_chain_changed",
        (data: EffectsChainChangedData) => {
          updateUserEffectChains(data.userId, data.chains);
          roomAudio
            .applyUserEffectChains(
              data.userId,
              data.chains,
              data.username,
            )
            .catch((error: unknown) => {
              console.error(
                "❌ Failed to apply remote effects chain:",
                error,
              );
            });
        },
      );

      on(
        "request_synth_params_response",
        (data: RequestSynthParamsResponseData) => {
          if (requestSynthParamsResponseCallbackRef.current) {
            requestSynthParamsResponseCallbackRef.current(data);
          }
        },
      );

      on(
        "auto_send_synth_params_to_new_user",
        (data: AutoSendSynthParamsData) => {
          // console.log("🎛️ Auto send synth params to new user:", data);
          if (autoSendSynthParamsToNewUserCallbackRef.current) {
            autoSendSynthParamsToNewUserCallbackRef.current(data);
          } else {
            // console.log("🔧 No autoSendSynthParamsToNewUser callback set");
          }
        },
      );

      on(
        "send_current_synth_params_to_new_user",
        (data: AutoSendSynthParamsData) => {
          // console.log("🎛️ Send current synth params to new user:", data);
          if (sendCurrentSynthParamsToNewUserCallbackRef.current) {
            sendCurrentSynthParamsToNewUserCallbackRef.current(data);
          } else {
            // console.log("🔧 No sendCurrentSynthParamsToNewUser callback set");
          }
        },
      );

      on(
        "request_current_synth_params_for_new_user",
        (data: NewUserSynthParamsData) => {
          // console.log("🎛️ Request current synth params for new user:", data);
          if (requestCurrentSynthParamsForNewUserCallbackRef.current) {
            requestCurrentSynthParamsForNewUserCallbackRef.current(data);
          } else {
            // console.log("🔧 No requestCurrentSynthParamsForNewUser callback set");
          }
        },
      );

      on(
        "send_synth_params_to_new_user_now",
        (data: NewUserSynthParamsData) => {
          // console.log("🎛️ Send synth params to new user now:", data);
          if (sendSynthParamsToNewUserNowCallbackRef.current) {
            sendSynthParamsToNewUserNowCallbackRef.current(data);
          } else {
            // console.log("🔧 No sendSynthParamsToNewUserNow callback set");
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
      on("voice_offer", () => { });
      on("voice_answer", () => { });
      on("voice_ice_candidate", () => { });
      on("user_joined_voice", () => { });
      on("user_left_voice", () => { });
      on("voice_mute_changed", () => { });
      on("voice_participants", () => { });
      on("request_voice_participants", () => { });
      on("request_mesh_connections", () => { });
      on("voice_heartbeat", () => { });

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
    updateUserEffectChains,
    transferOwnership,
    clearRoom,
    setPendingApproval,
    executePendingOperations,
    setIsConnecting,
    roomAudio,
    setRoomError,
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
        const userId = UserService.getUserId();
        const username = UserService.getUsername();

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
      // console.log("🚪 Emitting join_room event:", { roomId, username, userId, role });
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
      // console.log("🎛️ Updating synth params:", params);
      // const socket = getActiveSocket();
      // console.log("🎛️ Current socket state:", {
      //   socket: !!socket,
      //   connected: socket?.connected,
      //   id: socket?.id,
      // });
      // console.log("🎛️ Throttled emit synth params");
      throttledEmit("update_synth_params", { params });
    },
    [throttledEmit],
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
    (targetUserId: string, synthParams?: any, sequencerState?: any) => {
      safeEmit("request_instrument_swap", { targetUserId, synthParams, sequencerState });
    },
    [safeEmit],
  );

  const approveInstrumentSwap = useCallback(
    (requesterId: string, synthParams?: any, sequencerState?: any) => {
      safeEmit("approve_instrument_swap", { requesterId, synthParams, sequencerState });
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
      if (!socket) return () => { };
      const handler = (data: { requesterId: string }) => callback(data);
      socket.on("sequencer_state_requested", handler);
      return () => socket.off("sequencer_state_requested", handler);
    },
    [getActiveSocket],
  );

  const onSequencerStateReceived = useCallback(
    (callback: (data: { fromUserId: string; snapshot: { banks: any; settings: any; currentBank: string } }) => void) => {
      const socket = getActiveSocket();
      if (!socket) return () => { };
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
        // console.log("🔧 No active socket for onNoteReceived");
        return () => { };
      }

      // console.log("🎵 Setting up note_played listener on socket:", socket.id);

      const handleNoteReceived = (data: NoteReceivedData) => {
        // console.log("🎵 Note received:", data);
        callback(data);
      };

      socket.on("note_played", handleNoteReceived);

      return () => {
        // console.log("🔧 Cleaning up note_played listener");
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

  const onRoomUpdated = useCallback((callback: (room: any) => void) => {
    roomUpdatedCallbackRef.current = callback;
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
        // console.log("🔧 No active socket for onInstrumentChanged");
        return () => { };
      }

      // console.log(
      //   "🔧 Setting up instrument_changed listener on socket:",
      //   socket.id,
      // );

      const handleInstrumentChanged = (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => {
        // console.log("🎵 Instrument changed callback triggered:", data);
        callback(data);
      };

      socket.on("instrument_changed", handleInstrumentChanged);

      return () => {
        // console.log("🔧 Cleaning up instrument_changed listener");
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
        // console.log("🔧 No active socket for onStopAllNotes");
        return () => { };
      }

      // console.log(
      //   "🔧 Setting up stop_all_notes listener on socket:",
      //   socket.id,
      // );

      const handleStopAllNotes = (data: {
        userId: string;
        username: string;
        instrument: string;
        category: string;
      }) => {
        // console.log("🛑 Stop all notes callback triggered:", data);
        callback(data);
      };

      socket.on("stop_all_notes", handleStopAllNotes);

      return () => {
        // console.log("🔧 Cleaning up stop_all_notes listener");
        socket.off("stop_all_notes", handleStopAllNotes);
      };
    },
    [getActiveSocket],
  );

  const onSynthParamsChanged = useCallback(
    (callback: (data: SynthParamsData) => void) => {
      synthParamsChangedCallbackRef.current = callback;
      return () => {
        synthParamsChangedCallbackRef.current = null;
      };
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
      return () => {
        requestSynthParamsResponseCallbackRef.current = null;
      };
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
      return () => {
        autoSendSynthParamsToNewUserCallbackRef.current = null;
      };
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
      return () => {
        sendCurrentSynthParamsToNewUserCallbackRef.current = null;
      };
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
      return () => {
        requestCurrentSynthParamsForNewUserCallbackRef.current = null;
      };
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
      return () => {
        sendSynthParamsToNewUserNowCallbackRef.current = null;
      };
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
        // console.log("🔧 No active socket for onSwapRequestReceived");
        return () => { };
      }

      const handleSwapRequest = (data: { requesterId: string; requesterUsername: string }) => {
        // console.log("🔄 Swap request received:", data);
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
        // console.log("🔧 No active socket for onSwapRequestSent");
        return () => { };
      }

      const handleSwapRequestSent = (data: { targetUserId: string }) => {
        // console.log("🔄 Swap request sent:", data);
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
        // console.log("🔧 No active socket for onSwapApproved");
        return () => { };
      }

      const handleSwapApproved = (data: any) => {
        // console.log("✅ Swap approved:", data);
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
        // console.log("🔧 No active socket for onSwapRejected");
        return () => { };
      }

      const handleSwapRejected = () => {
        // console.log("❌ Swap rejected");
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
        // console.log("🔧 No active socket for onSwapCancelled");
        return () => { };
      }

      const handleSwapCancelled = () => {
        // console.log("🚫 Swap cancelled");
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
        // console.log("🔧 No active socket for onSwapCompleted");
        return () => { };
      }

      const handleSwapCompleted = (data: any) => {
        // console.log("🔄 Swap completed:", data);
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
        // console.log("🔧 No active socket for onUserKicked");
        return () => { };
      }

      const handleUserKicked = (data: { reason: string }) => {
        // console.log("👢 User kicked:", data);
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
        // console.log("🔧 No active socket for onRoomOwnerScaleChanged");
        return () => { };
      }

      // console.log("🎵 Setting up room_owner_scale_changed listener on socket:", socket.id);

      const handleRoomOwnerScaleChanged = (data: import('../../../shared/types').RoomOwnerScaleChangedEvent) => {
        // console.log("🎵 Room owner scale changed:", data);
        callback(data);
      };

      socket.on("room_owner_scale_changed", handleRoomOwnerScaleChanged);

      return () => {
        // console.log("🔧 Cleaning up room_owner_scale_changed listener");
        socket.off("room_owner_scale_changed", handleRoomOwnerScaleChanged);
      };
    },
    [getActiveSocket],
  );

  const onFollowRoomOwnerToggled = useCallback(
    (callback: (data: import('../../../shared/types').FollowRoomOwnerToggledEvent) => void) => {
      const socket = getActiveSocket();
      if (!socket) {
        // console.log("🔧 No active socket for onFollowRoomOwnerToggled");
        return () => { };
      }

      // console.log("🎵 Setting up follow_room_owner_toggled listener on socket:", socket.id);

      const handleFollowRoomOwnerToggled = (data: import('../../../shared/types').FollowRoomOwnerToggledEvent) => {
        // console.log("🎵 Follow room owner toggled:", data);
        callback(data);
      };

      socket.on("follow_room_owner_toggled", handleFollowRoomOwnerToggled);

      return () => {
        // console.log("🔧 Cleaning up follow_room_owner_toggled listener");
        socket.off("follow_room_owner_toggled", handleFollowRoomOwnerToggled);
      };
    },
    [getActiveSocket],
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    queueRef.current?.clear();
    recentNoteEvents.current.clear();
  }, []);

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
    onRoomUpdated,
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
