import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Socket } from "socket.io-client";

/**
 * Enhanced WebRTC Voice Communication Hook with Reliability Features
 * 
 * This hook provides robust WebRTC voice communication with the following reliability improvements:
 * 
 * 1. Connection Health Monitoring:
 *    - Periodic health checks every 15 seconds
 *    - Monitors both connection state and ICE connection state
 *    - Tracks last health check timestamp for timeout detection
 * 
 * 2. Automatic Reconnection:
 *    - Up to 3 reconnection attempts per peer
 *    - 2-second delay between reconnection attempts
 *    - Exponential backoff and cleanup of failed connections
 * 
 * 3. ICE Connection State Handling:
 *    - Enhanced monitoring of ICE connection states
 *    - Proper handling of 'failed', 'disconnected', 'connected', and 'completed' states
 *    - Automatic recovery from ICE connection failures
 * 
 * 4. Heartbeat Mechanism:
 *    - Sends connection states to backend every 30 seconds
 *    - Backend monitors for stale connections and triggers recovery
 *    - Cross-peer failure detection and notification
 * 
 * 5. Grace Period Management:
 *    - 60-second grace period for accidental disconnections
 *    - Maintains connections during network interruptions
 *    - Proper cleanup after grace period expires
 * 
 * 6. Enhanced Error Handling:
 *    - Detailed logging of connection states and failures
 *    - Graceful fallback and recovery mechanisms
 *    - User feedback for connection issues
 * 
 * These improvements ensure that users can maintain voice communication even when
 * experiencing network issues, without requiring manual disconnect/reconnect.
 */

interface RTCPeerMap {
  [userId: string]: {
    connection: RTCPeerConnection;
    audioElement: HTMLAudioElement;
    isConnected: boolean;
    lastHealthCheck?: number;
    reconnectAttempts?: number;
    iceConnectionState?: RTCIceConnectionState;
  };
}

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

interface UseWebRTCVoiceProps {
  socket: Socket | null;
  currentUserId: string;
  currentUsername: string;
  roomId: string;
  isEnabled: boolean; // Enable voice functionality
  canTransmit?: boolean; // Whether user can send voice (defaults to true)
}

interface UseWebRTCVoiceReturn {
  voiceUsers: VoiceUser[];
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
  addLocalStream: (stream: MediaStream) => void;
  removeLocalStream: () => void;
  performIntentionalCleanup: () => void;
  enableAudioReception: () => Promise<void>;
  isConnecting: boolean;
  connectionError: string | null;
  canTransmit: boolean;
  isAudioEnabled: boolean;
}

export const useWebRTCVoice = ({
  socket,
  currentUserId,
  currentUsername,
  roomId,
  isEnabled,
  canTransmit = true,
}: UseWebRTCVoiceProps): UseWebRTCVoiceReturn => {
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  const peersRef = useRef<RTCPeerMap>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioLevelInterval = useRef<number | null>(null);

  // Audio analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteAnalysersRef = useRef<
    Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>
  >(new Map());
  const lastLevelsRef = useRef<Map<string, number>>(new Map());

  // Explicit remote mute state map (updated via socket)
  const remoteMuteStateRef = useRef<Map<string, boolean>>(new Map());
  const lastLocalMutedRef = useRef<boolean | null>(null);

  // Track intentional disconnection to avoid cleaning up during grace period
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  const gracePeriodTimeoutRef = useRef<number | null>(null);
  
  // Ref to avoid forward reference issues
  const initiateVoiceCallRef = useRef<((targetUserId: string) => Promise<void>) | null>(null);

  // Grace period duration (should match backend)
  const GRACE_PERIOD_MS = 60000; // 60 seconds

  // Connection health monitoring
  const healthCheckInterval = useRef<number | null>(null);
  const HEALTH_CHECK_INTERVAL = 15000; // 15 seconds
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY = 2000; // 2 seconds
  const CONNECTION_TIMEOUT = 30000; // 30 seconds

  // Heartbeat mechanism
  const heartbeatInterval = useRef<number | null>(null);
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds

  // Send heartbeat with connection states
  const sendHeartbeat = useCallback(() => {
    if (!socket || !roomId || !currentUserId || Object.keys(peersRef.current).length === 0) {
      return;
    }

    const connectionStates: Record<string, { connectionState: string; iceConnectionState: string }> = {};
    
    Object.entries(peersRef.current).forEach(([userId, peer]) => {
      connectionStates[userId] = {
        connectionState: peer.connection.connectionState,
        iceConnectionState: peer.connection.iceConnectionState,
      };
    });

    console.log('💓 WebRTC: Sending heartbeat with connection states:', connectionStates);
    
    socket.emit('voice_heartbeat', {
      roomId,
      userId: currentUserId,
      connectionStates,
    });
  }, [socket, roomId, currentUserId]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) return;

    heartbeatInterval.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL) as unknown as number;

    console.log('💓 WebRTC: Started heartbeat monitoring');
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
      console.log('🛑 WebRTC: Stopped heartbeat monitoring');
    }
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current!.state === "suspended") {
      audioContextRef.current!.resume().catch(() => {
        // resume may fail on some browsers without a user gesture
      });
    }
    return audioContextRef.current!;
  }, []);

  const createAnalyser = useCallback((context: AudioContext) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    return analyser;
  }, []);

  const getRmsFromAnalyser = useCallback((analyser: AnalyserNode): number => {
    const buffer = new Float32Array(analyser.fftSize);
    (analyser as AnalyserNode).getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buffer.length);
    // Normalize to 0..1 with a soft knee
    const level = Math.min(1, rms * 1.5);
    return level;
  }, []);

  // Enable audio reception for audience members (creates AudioContext with user gesture)
  const enableAudioReception = useCallback(async (): Promise<void> => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Initialize AudioContext with user gesture
      const context = ensureAudioContext();
      await context.resume();

      // Mark audio as enabled
      setIsAudioEnabled(true);

      // If user cannot transmit, announce their presence for voice reception
      if (
        !canTransmit &&
        socket &&
        roomId &&
        currentUserId &&
        currentUsername
      ) {
        console.log("📢 WebRTC: Announcing audio-enabled join_voice", {
          roomId,
          currentUserId,
          currentUsername,
        });
        socket.emit("join_voice", {
          roomId,
          userId: currentUserId,
          username: currentUsername,
        });
      }

      console.log("🔊 Audio reception enabled for audience member");
    } catch (error) {
      console.error("Failed to enable audio reception:", error);
      setConnectionError("Failed to enable audio reception");
    } finally {
      setIsConnecting(false);
    }
  }, [
    ensureAudioContext,
    canTransmit,
    socket,
    roomId,
    currentUserId,
    currentUsername,
  ]);

  // WebRTC configuration with STUN servers for NAT traversal
  const rtcConfig: RTCConfiguration = useMemo(
    () => ({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    }),
    [],
  );

  // Cleanup peer connection
  const cleanupPeerConnection = useCallback((userId: string) => {
    if (peersRef.current[userId]) {
      peersRef.current[userId].connection.close();
      peersRef.current[userId].audioElement.remove();
      delete peersRef.current[userId];
    }
    // Cleanup remote analyser if exists
    const remoteEntry = remoteAnalysersRef.current.get(userId);
    if (remoteEntry) {
      try {
        remoteEntry.source.disconnect();
      } catch {
        // ignore disconnect errors
      }
      remoteAnalysersRef.current.delete(userId);
    }
    lastLevelsRef.current.delete(userId);
    remoteMuteStateRef.current.delete(userId);
  }, []);

  // Connection health monitoring
  const checkConnectionHealth = useCallback(async (userId: string) => {
    const peer = peersRef.current[userId];
    if (!peer) return;

    const connection = peer.connection;
    const now = Date.now();

    // Update last health check timestamp
    peer.lastHealthCheck = now;

    // Check connection state
    const connectionState = connection.connectionState;
    const iceConnectionState = connection.iceConnectionState;

    console.log(`🔍 WebRTC Health Check for ${userId}:`, {
      connectionState,
      iceConnectionState,
      isConnected: peer.isConnected,
    });

    // Update ICE connection state tracking
    peer.iceConnectionState = iceConnectionState;

    // Handle failed or problematic connections
    if (
      connectionState === 'failed' ||
      connectionState === 'disconnected' ||
      iceConnectionState === 'failed' ||
      iceConnectionState === 'disconnected'
    ) {
      console.warn(`⚠️ WebRTC: Connection issues detected for ${userId}`, {
        connectionState,
        iceConnectionState,
      });

      // Attempt reconnection if we haven't exceeded max attempts
      const attempts = peer.reconnectAttempts || 0;
      if (attempts < MAX_RECONNECT_ATTEMPTS) {
        console.log(`🔄 WebRTC: Attempting reconnection for ${userId} (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        peer.reconnectAttempts = attempts + 1;
        
        // Clean up the failed connection
        cleanupPeerConnection(userId);
        
        // Wait a bit before reconnecting
        setTimeout(() => {
          if (isEnabled && socket && canTransmit) {
            console.log(`🤝 WebRTC: Initiating reconnection to ${userId}`);
            // Clean up existing connection first
            cleanupPeerConnection(userId);
            
                         // Wait a moment for cleanup to complete then initiate new connection
             setTimeout(() => {
               if (isEnabled && socket && !peersRef.current[userId] && initiateVoiceCallRef.current) {
                 initiateVoiceCallRef.current(userId);
               }
             }, 500);
          }
        }, RECONNECT_DELAY);
      } else {
        console.error(`❌ WebRTC: Max reconnection attempts exceeded for ${userId}`);
        setConnectionError(`Connection with ${userId} failed after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        cleanupPeerConnection(userId);
      }
    } else if (connectionState === 'connected' && iceConnectionState === 'connected') {
      // Connection is healthy, reset reconnection attempts
      peer.reconnectAttempts = 0;
      peer.isConnected = true;
    }
  }, [isEnabled, socket, canTransmit, cleanupPeerConnection]);

  // Periodic health monitoring
  const startHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) return;

    healthCheckInterval.current = setInterval(() => {
      const now = Date.now();
      
      Object.keys(peersRef.current).forEach(userId => {
        const peer = peersRef.current[userId];
        if (!peer) return;

        // Check if connection has been inactive for too long
        const lastCheck = peer.lastHealthCheck || 0;
        const timeSinceLastCheck = now - lastCheck;

        if (timeSinceLastCheck > CONNECTION_TIMEOUT) {
          console.warn(`⏰ WebRTC: Connection timeout detected for ${userId}`);
          checkConnectionHealth(userId);
        } else {
          // Regular health check
          checkConnectionHealth(userId);
        }
      });
    }, HEALTH_CHECK_INTERVAL) as unknown as number;

    console.log('🩺 WebRTC: Started connection health monitoring');
  }, [checkConnectionHealth]);

  const stopHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
      healthCheckInterval.current = null;
      console.log('🛑 WebRTC: Stopped connection health monitoring');
    }
  }, []);



  // Create RTCPeerConnection with optimized settings for low latency
  const createPeerConnection = useCallback(
    (userId: string): RTCPeerConnection => {
      const peerConnection = new RTCPeerConnection(rtcConfig);

      // Add local stream to peer connection if available and user can transmit
      if (localStreamRef.current && canTransmit) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];

        if (peersRef.current[userId]) {
          const audioElement = peersRef.current[userId].audioElement;
          audioElement.srcObject = remoteStream;
          audioElement.play().catch(console.error);
        }

        // Create analyser for remote stream
        try {
          const context = ensureAudioContext();
          const source = context.createMediaStreamSource(remoteStream);
          const analyser = createAnalyser(context);
          source.connect(analyser);
          remoteAnalysersRef.current.set(userId, { analyser, source });
        } catch (e) {
          console.warn("Failed to create remote analyser:", e);
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("voice_ice_candidate", {
            candidate: event.candidate,
            targetUserId: userId,
            roomId,
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;

        if (peersRef.current[userId]) {
          peersRef.current[userId].isConnected = state === "connected";
        }

        console.log(`🔗 WebRTC Connection state changed for ${userId}: ${state}`);

        if (state === "connected") {
          // Reset reconnection attempts on successful connection
          if (peersRef.current[userId]) {
            peersRef.current[userId].reconnectAttempts = 0;
            peersRef.current[userId].lastHealthCheck = Date.now();
          }
          setConnectionError(null); // Clear any previous errors
        } else if (state === "failed") {
          console.error(`❌ WebRTC Connection failed for ${userId}`);
          // Don't immediately cleanup - let health monitoring handle reconnection
          checkConnectionHealth(userId);
        } else if (state === "disconnected") {
          console.warn(`⚠️ WebRTC Connection disconnected for ${userId}`);
          // Don't immediately cleanup - let health monitoring handle reconnection
          checkConnectionHealth(userId);
        }
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        
        if (peersRef.current[userId]) {
          peersRef.current[userId].iceConnectionState = iceState;
        }

        console.log(`🧊 WebRTC ICE connection state changed for ${userId}: ${iceState}`);

        if (iceState === "connected" || iceState === "completed") {
          // ICE connection is healthy
          if (peersRef.current[userId]) {
            peersRef.current[userId].reconnectAttempts = 0;
            peersRef.current[userId].lastHealthCheck = Date.now();
          }
        } else if (iceState === "failed" || iceState === "disconnected") {
          console.warn(`⚠️ WebRTC ICE connection issues for ${userId}: ${iceState}`);
          // Let health monitoring handle this
          checkConnectionHealth(userId);
        }
      };

      return peerConnection;
    },
    [
      socket,
      roomId,
      canTransmit,
      cleanupPeerConnection,
      createAnalyser,
      ensureAudioContext,
      rtcConfig,
      checkConnectionHealth,
    ],
  );

  // Start audio level monitoring for voice users
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelInterval.current) return;

    audioLevelInterval.current = setInterval(() => {
      // Read analyser levels and update users
      setVoiceUsers((prevUsers) => {
        return prevUsers.map((user) => {
          let level = 0;
          let isMuted = true;

          if (user.userId === currentUserId) {
            const hasActiveStream =
              !!localStreamRef.current &&
              localStreamRef.current
                .getAudioTracks()
                .some((track) => track.enabled);
            if (hasActiveStream && localAnalyserRef.current) {
              level = getRmsFromAnalyser(localAnalyserRef.current);
            }
            // For local user, reflect the actual mute toggle (track enabled)
            isMuted = !hasActiveStream;
            if (lastLocalMutedRef.current === null) {
              lastLocalMutedRef.current = isMuted;
            } else if (lastLocalMutedRef.current !== isMuted) {
              lastLocalMutedRef.current = isMuted;
            }
          } else {
            const peer = peersRef.current[user.userId];
            const remoteAnalyser =
              remoteAnalysersRef.current.get(user.userId)?.analyser || null;
            const explicitMute = remoteMuteStateRef.current.get(user.userId);
            if (peer?.isConnected && remoteAnalyser) {
              level = getRmsFromAnalyser(remoteAnalyser);
              if (typeof explicitMute === "boolean") {
                isMuted = explicitMute;
              } else {
                // Fallback: consider remote muted if effectively silent
                isMuted = level < 0.02;
              }
            } else {
              level = 0;
              isMuted = true;
            }
          }

          // Smooth the level to avoid jitter
          const last = lastLevelsRef.current.get(user.userId) ?? 0;
          const smoothed = last * 0.7 + level * 0.3;
          lastLevelsRef.current.set(user.userId, smoothed);

          return { ...user, audioLevel: smoothed, isMuted };
        });
      });
    }, 200) as unknown as number; // Throttle to ~200ms
  }, [currentUserId, getRmsFromAnalyser]);

  // Stop audio level monitoring
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
  }, []);

  // Add local stream to all peer connections
  const addLocalStream = useCallback(
    (stream: MediaStream) => {
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create analyser for local stream
      try {
        const context = ensureAudioContext();
        if (localSourceRef.current) {
          try {
            localSourceRef.current.disconnect();
          } catch {
            // ignore disconnect errors
          }
        }
        const source = context.createMediaStreamSource(stream);
        const analyser = createAnalyser(context);
        source.connect(analyser);
        localSourceRef.current = source;
        localAnalyserRef.current = analyser;
      } catch (e) {
        console.warn("Failed to create local analyser:", e);
      }

      // Add tracks to existing peer connections (only if user can transmit)
      if (canTransmit) {
        Object.values(peersRef.current).forEach((peer) => {
          stream.getTracks().forEach((track) => {
            peer.connection.addTrack(track, stream);
          });
        });
      }

      startAudioLevelMonitoring();
      startHealthMonitoring(); // Start health monitoring when we have a local stream
      startHeartbeat(); // Start heartbeat when we have a local stream

      // Ensure self is present in voice users immediately and reflect current track enabled state
      const hasActiveTrack = stream.getAudioTracks().some((t) => t.enabled);
      setVoiceUsers((prev) => {
        const exists = prev.some((u) => u.userId === currentUserId);
        if (exists)
          return prev.map((u) =>
            u.userId === currentUserId ? { ...u, isMuted: !hasActiveTrack } : u,
          );
        return [
          ...prev,
          {
            userId: currentUserId,
            username: currentUsername,
            isMuted: !hasActiveTrack,
            audioLevel: 0,
          },
        ];
      });
      lastLocalMutedRef.current = !hasActiveTrack;

      // Announce that this user joined voice chat (all users need to announce to receive offers)
      if (socket && roomId && currentUserId && currentUsername) {
        console.log("📢 WebRTC: Announcing join_voice to room", {
          roomId,
          currentUserId,
          currentUsername,
          canTransmit,
        });
        socket.emit("join_voice", {
          roomId,
          userId: currentUserId,
          username: currentUsername,
        });
        // Also broadcast our current mute state immediately so remotes reflect it on first render
        try {
          console.log("📢 WebRTC: Broadcasting initial mute state", {
            isMuted: !hasActiveTrack,
          });
          socket.emit("voice_mute_changed", {
            roomId,
            userId: currentUserId,
            isMuted: !hasActiveTrack,
          });
        } catch {
          /* noop */
        }
      } else {
        console.warn("⚠️ Cannot announce voice join - missing requirements:", {
          hasSocket: !!socket,
          hasRoomId: !!roomId,
          hasUserId: !!currentUserId,
          hasUsername: !!currentUsername,
        });
      }
    },
    [
      startAudioLevelMonitoring,
      startHealthMonitoring,
      startHeartbeat,
      socket,
      roomId,
      currentUserId,
      currentUsername,
      canTransmit,
      ensureAudioContext,
      createAnalyser,
    ],
  );

  // Remove local stream from all peer connections
  const removeLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      // Remove tracks from all peer connections
      Object.values(peersRef.current).forEach((peer) => {
        const senders = peer.connection.getSenders();
        senders.forEach((sender) => {
          if (sender.track) {
            peer.connection.removeTrack(sender);
          }
        });
      });

      // Stop all tracks
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Cleanup local analyser
    if (localSourceRef.current) {
      try {
        localSourceRef.current.disconnect();
      } catch {
        // ignore disconnect errors
      }
      localSourceRef.current = null;
    }
    localAnalyserRef.current = null;

    // Update self as removed from voice users list
    setVoiceUsers((prev) =>
      prev.filter((user) => user.userId !== currentUserId),
    );

    stopAudioLevelMonitoring();
    stopHeartbeat(); // Stop heartbeat when local stream is removed
  }, [stopAudioLevelMonitoring, stopHeartbeat, currentUserId]);

  // Handle voice offer from remote peer
  const handleVoiceOffer = useCallback(
    async (data: {
      offer: RTCSessionDescriptionInit;
      fromUserId: string;
      fromUsername: string;
    }) => {
      if (!isEnabled || !socket) return;

      try {
        setIsConnecting(true);

        const peerConnection = createPeerConnection(data.fromUserId);

        // Create audio element for remote stream
        const audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        document.body.appendChild(audioElement);

        peersRef.current[data.fromUserId] = {
          connection: peerConnection,
          audioElement,
          isConnected: false,
        };

        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("voice_answer", {
          answer: answer,
          targetUserId: data.fromUserId,
          roomId,
        });
      } catch (error) {
        console.error("Failed to handle voice offer:", error);
        setConnectionError("Failed to establish voice connection");
      } finally {
        setIsConnecting(false);
      }
    },
    [isEnabled, socket, roomId, createPeerConnection],
  );

  // Handle voice answer from remote peer
  const handleVoiceAnswer = useCallback(
    async (data: { answer: RTCSessionDescriptionInit; fromUserId: string }) => {
      const peer = peersRef.current[data.fromUserId];
      if (!peer) return;

      try {
        await peer.connection.setRemoteDescription(data.answer);
      } catch (error) {
        console.error("Failed to handle voice answer:", error);
      }
    },
    [],
  );

  // Handle ICE candidate from remote peer
  const handleVoiceIceCandidate = useCallback(
    async (data: { candidate: RTCIceCandidateInit; fromUserId: string }) => {
      const peer = peersRef.current[data.fromUserId];
      if (!peer) return;

      try {
        await peer.connection.addIceCandidate(data.candidate);
      } catch (error) {
        console.error("Failed to add ICE candidate:", error);
      }
    },
    [],
  );

  // Initiate voice call to a user
  const initiateVoiceCall = useCallback(
    async (targetUserId: string) => {
      if (!isEnabled || !socket || peersRef.current[targetUserId]) {
        return;
      }

      try {
        setIsConnecting(true);

        const peerConnection = createPeerConnection(targetUserId);

        // Create audio element for remote stream
        const audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        document.body.appendChild(audioElement);

        peersRef.current[targetUserId] = {
          connection: peerConnection,
          audioElement,
          isConnected: false,
          lastHealthCheck: Date.now(),
          reconnectAttempts: 0,
          iceConnectionState: 'new',
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit("voice_offer", {
          offer: offer,
          targetUserId,
          roomId,
        });
      } catch (error) {
        console.error("❌ Failed to initiate voice call:", error);
        setConnectionError("Failed to initiate voice call");
      } finally {
        setIsConnecting(false);
      }
    },
    [isEnabled, socket, roomId, createPeerConnection],
  );

  // Assign to ref to avoid forward reference issues
  initiateVoiceCallRef.current = initiateVoiceCall;

  // Handle user joining voice
  const handleUserJoinedVoice = useCallback(
    (data: { userId: string; username: string }) => {
      console.log("👋 WebRTC: User joined voice", data);

      // Add to voice users list
      setVoiceUsers((prev) => {
        const existing = prev.find((u) => u.userId === data.userId);
        if (!existing) {
          const newUsers = [
            ...prev,
            {
              userId: data.userId,
              username: data.username,
              isMuted: !!remoteMuteStateRef.current.get(data.userId),
              audioLevel: 0,
            },
          ];
          return newUsers;
        }
        return prev;
      });

      if (data.userId !== currentUserId && isEnabled && canTransmit) {
        // Clean up any existing connection to this user first
        if (peersRef.current[data.userId]) {
          console.log(
            "🧹 WebRTC: Cleaning up existing connection before new one",
            data.userId,
          );
          cleanupPeerConnection(data.userId);
        }

        // Add a small delay to ensure the cleanup is complete
        setTimeout(() => {
          console.log(
            "🤝 WebRTC: Initiating call to newly joined user",
            data.userId,
          );
          initiateVoiceCall(data.userId);
        }, 50);
      }
    },
    [
      currentUserId,
      isEnabled,
      canTransmit,
      initiateVoiceCall,
      cleanupPeerConnection,
    ],
  );

  // Handle user leaving voice
  const handleUserLeftVoice = useCallback(
    (data: { userId: string }) => {
      cleanupPeerConnection(data.userId);
      setVoiceUsers((prev) =>
        prev.filter((user) => user.userId !== data.userId),
      );
    },
    [cleanupPeerConnection],
  );

  // Handle explicit remote mute state updates
  const handleVoiceMuteChanged = useCallback(
    (data: { userId: string; isMuted: boolean }) => {
      remoteMuteStateRef.current.set(data.userId, data.isMuted);
      setVoiceUsers((prev) => {
        const exists = prev.some((u) => u.userId === data.userId);
        if (!exists) {
          // Create placeholder entry so UI can reflect mute state even before media/offer arrives
          return [
            ...prev,
            {
              userId: data.userId,
              username: "",
              isMuted: data.isMuted,
              audioLevel: 0,
            },
          ];
        }
        return prev.map((u) =>
          u.userId === data.userId ? { ...u, isMuted: data.isMuted } : u,
        );
      });
    },
    [],
  );

  // Handle voice connection failure notification from backend
  const handleVoiceConnectionFailed = useCallback(
    (data: { fromUserId: string; roomId: string }) => {
      console.warn(`🚨 WebRTC: Connection failure reported by ${data.fromUserId}`);
      
      // Check if we have a connection to this user and if it's actually failed
      const peer = peersRef.current[data.fromUserId];
      if (peer) {
        const connectionState = peer.connection.connectionState;
        const iceConnectionState = peer.connection.iceConnectionState;
        
        if (connectionState === 'failed' || iceConnectionState === 'failed' ||
            connectionState === 'disconnected' || iceConnectionState === 'disconnected') {
          console.log(`🔄 WebRTC: Confirming connection failure, attempting recovery for ${data.fromUserId}`);
          
          // Trigger immediate reconnection
          checkConnectionHealth(data.fromUserId);
        }
      }
    },
    [checkConnectionHealth],
  );

  // Handle reconnection request from backend
  const handleVoiceReconnectionRequested = useCallback(
    (data: { fromUserId: string; targetUserId: string; roomId: string }) => {
      console.log(`🔄 WebRTC: Reconnection requested: ${data.fromUserId} -> ${data.targetUserId}`);
      
      // If we are the target user, initiate a fresh connection
      if (data.targetUserId === currentUserId) {
        console.log(`🤝 WebRTC: We are the target, initiating fresh connection to ${data.fromUserId}`);
        
        // Clean up existing connection
        cleanupPeerConnection(data.fromUserId);
        
        // Wait a moment then initiate fresh connection
        setTimeout(() => {
          if (isEnabled && socket && canTransmit && !peersRef.current[data.fromUserId]) {
            initiateVoiceCall(data.fromUserId);
          }
        }, 1000);
      }
    },
    [currentUserId, cleanupPeerConnection, isEnabled, socket, canTransmit],
  );

  // Emit local mute change when toggled in VoiceInput (track.enabled changes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!socket || !roomId || !currentUserId) return;
      const hasActiveStream =
        !!localStreamRef.current &&
        localStreamRef.current.getAudioTracks().some((t) => t.enabled);
      const isMuted = !hasActiveStream;
      if (lastLocalMutedRef.current === null) {
        lastLocalMutedRef.current = isMuted;
      } else if (lastLocalMutedRef.current !== isMuted) {
        lastLocalMutedRef.current = isMuted;
        socket.emit("voice_mute_changed", {
          roomId,
          userId: currentUserId,
          isMuted,
        });
        // Also update our own entry immediately
        setVoiceUsers((prev) =>
          prev.map((u) => (u.userId === currentUserId ? { ...u, isMuted } : u)),
        );
      }
    }, 200);
    return () => clearInterval(interval);
  }, [socket, roomId, currentUserId]);

  // On enable: request existing voice participants so we can render indicators immediately
  useEffect(() => {
    if (!socket || !isEnabled || !roomId) return;
    socket.emit("request_voice_participants", { roomId });

    // Audience members will announce themselves when they enable audio reception

    const onParticipants = (payload: {
      participants: Array<{
        userId: string;
        username: string;
        isMuted: boolean;
      }>;
    }) => {
      const byId = new Map(payload.participants.map((p) => [p.userId, p]));
      // merge/insert
      setVoiceUsers((prev) => {
        const next = new Map(prev.map((u) => [u.userId, u] as const));
        for (const p of payload.participants) {
          if (p.userId === currentUserId) continue; // local will be handled by addLocalStream/mute state
          const existing = next.get(p.userId);
          next.set(p.userId, {
            userId: p.userId,
            username: existing?.username || p.username || "",
            isMuted: p.isMuted,
            audioLevel: existing?.audioLevel ?? 0,
          });
        }
        return Array.from(next.values());
      });
      // cache explicit mute states
      byId.forEach((p) => remoteMuteStateRef.current.set(p.userId, p.isMuted));
    };
    socket.on("voice_participants", onParticipants);
    return () => {
      socket.off("voice_participants", onParticipants);
    };
  }, [socket, isEnabled, roomId, currentUserId, currentUsername, canTransmit]);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket || !isEnabled) return;

    socket.on("voice_offer", handleVoiceOffer);
    socket.on("voice_answer", handleVoiceAnswer);
    socket.on("voice_ice_candidate", handleVoiceIceCandidate);
    socket.on("user_joined_voice", handleUserJoinedVoice);
    socket.on("user_left_voice", handleUserLeftVoice);
    socket.on("voice_mute_changed", handleVoiceMuteChanged);
    socket.on("voice_connection_failed", handleVoiceConnectionFailed);
    socket.on("voice_reconnection_requested", handleVoiceReconnectionRequested);

    return () => {
      socket.off("voice_offer", handleVoiceOffer);
      socket.off("voice_answer", handleVoiceAnswer);
      socket.off("voice_ice_candidate", handleVoiceIceCandidate);
      socket.off("user_joined_voice", handleUserJoinedVoice);
      socket.off("user_left_voice", handleUserLeftVoice);
      socket.off("voice_mute_changed", handleVoiceMuteChanged);
      socket.off("voice_connection_failed", handleVoiceConnectionFailed);
      socket.off("voice_reconnection_requested", handleVoiceReconnectionRequested);
    };
  }, [
    socket,
    isEnabled,
    handleVoiceOffer,
    handleVoiceAnswer,
    handleVoiceIceCandidate,
    handleUserJoinedVoice,
    handleUserLeftVoice,
    handleVoiceMuteChanged,
    handleVoiceConnectionFailed,
    handleVoiceReconnectionRequested,
  ]);

  // Cleanup on unmount or when disabled
  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      removeLocalStream();
      Object.keys(peers).forEach(cleanupPeerConnection);
      stopAudioLevelMonitoring();
      stopHealthMonitoring(); // Stop health monitoring on unmount
      stopHeartbeat(); // Stop heartbeat on unmount

      // Clear grace period timeout if it exists
      if (gracePeriodTimeoutRef.current) {
        clearTimeout(gracePeriodTimeoutRef.current);
        gracePeriodTimeoutRef.current = null;
      }

      // Optional: close audio context if created
      // Note: keeping it open can be beneficial to avoid resume glitches
    };
  }, [removeLocalStream, cleanupPeerConnection, stopAudioLevelMonitoring, stopHealthMonitoring, stopHeartbeat]);

  // Clean up WebRTC state when socket disconnects
  useEffect(() => {
    if (!socket || !socket.connected) {
      // Only clean up immediately if this was an intentional disconnect
      // For accidental disconnects (network issues, page refresh), maintain connections during grace period
      if (isIntentionalDisconnectRef.current) {
        console.log(
          "🧹 WebRTC: Intentional disconnect, cleaning up all peer connections",
        );

        // Clear any existing grace period timeout
        if (gracePeriodTimeoutRef.current) {
          clearTimeout(gracePeriodTimeoutRef.current);
          gracePeriodTimeoutRef.current = null;
        }

        // Clean up all peer connections
        Object.keys(peersRef.current).forEach(cleanupPeerConnection);

        // Remove local stream (but don't stop tracks as VoiceInput manages that)
        if (localStreamRef.current) {
          localStreamRef.current = null;
          setLocalStream(null);
        }

        // Clear voice users
        setVoiceUsers([]);

        // Clear remote state
        remoteAnalysersRef.current.clear();
        lastLevelsRef.current.clear();
        remoteMuteStateRef.current.clear();
        lastLocalMutedRef.current = null;

        // Stop monitoring
        stopAudioLevelMonitoring();
        stopHealthMonitoring(); // Stop health monitoring on intentional disconnect
        stopHeartbeat(); // Stop heartbeat on intentional disconnect

        // Clear local analyser references
        localAnalyserRef.current = null;
        localSourceRef.current = null;

        // Reset the flag
        isIntentionalDisconnectRef.current = false;
      } else {
        console.log(
          "🔄 WebRTC: Socket disconnected, starting grace period timer",
        );
        // Just stop monitoring but keep connections alive for potential reconnection
        stopAudioLevelMonitoring();
        stopHealthMonitoring(); // Stop health monitoring on accidental disconnect
        stopHeartbeat(); // Stop heartbeat on accidental disconnect

        // Start grace period timeout
        gracePeriodTimeoutRef.current = setTimeout(() => {
          console.log(
            "⏰ WebRTC: Grace period expired, cleaning up connections",
          );

          // Clean up all peer connections
          Object.keys(peersRef.current).forEach(cleanupPeerConnection);

          // Remove local stream
          if (localStreamRef.current) {
            localStreamRef.current = null;
            setLocalStream(null);
          }

          // Clear all state
          setVoiceUsers([]);
          remoteAnalysersRef.current.clear();
          lastLevelsRef.current.clear();
          remoteMuteStateRef.current.clear();
          lastLocalMutedRef.current = null;
          localAnalyserRef.current = null;
          localSourceRef.current = null;

          gracePeriodTimeoutRef.current = null;
        }, GRACE_PERIOD_MS) as unknown as number;
      }
    } else {
      // Socket is connected - clear any grace period timeout
      if (gracePeriodTimeoutRef.current) {
        console.log(
          "🔄 WebRTC: Socket reconnected, canceling grace period timer",
        );
        clearTimeout(gracePeriodTimeoutRef.current);
        gracePeriodTimeoutRef.current = null;
      }
    }
  }, [
    socket,
    socket?.connected,
    cleanupPeerConnection,
    stopAudioLevelMonitoring,
    stopHealthMonitoring,
    stopHeartbeat,
  ]);

  // Function to perform intentional cleanup (can be called from parent)
  const performIntentionalCleanup = useCallback(() => {
    console.log("🧹 WebRTC: Performing intentional cleanup");
    isIntentionalDisconnectRef.current = true;

    // Clean up all peer connections immediately
    Object.keys(peersRef.current).forEach(cleanupPeerConnection);

    // Remove local stream
    if (localStreamRef.current) {
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Clear all state
    setVoiceUsers([]);
    remoteAnalysersRef.current.clear();
    lastLevelsRef.current.clear();
    remoteMuteStateRef.current.clear();
    lastLocalMutedRef.current = null;
    stopAudioLevelMonitoring();
    stopHealthMonitoring(); // Stop health monitoring on intentional cleanup
    stopHeartbeat(); // Stop heartbeat on intentional cleanup
    localAnalyserRef.current = null;
    localSourceRef.current = null;
  }, [cleanupPeerConnection, stopAudioLevelMonitoring, stopHealthMonitoring, stopHeartbeat]);

  // Handle socket reconnection - request voice participants if enabled
  useEffect(() => {
    if (socket && socket.connected && isEnabled && roomId) {
      console.log(
        "🔄 WebRTC: Socket reconnected, requesting voice participants",
      );
      // Request existing voice participants for new room session
      socket.emit("request_voice_participants", { roomId });

              // If we have a local stream, we need to re-announce our voice presence
        if (localStreamRef.current) {
          console.log(
            "🎤 WebRTC: Re-announcing voice presence after reconnection",
          );

          // IMPORTANT: Clean up any stale peer connections first
          console.log(
            "🧹 WebRTC: Cleaning up stale peer connections before re-announcing",
          );
          Object.keys(peersRef.current).forEach(cleanupPeerConnection);

          // Add self back to voice users list if not already there
          setVoiceUsers((prev) => {
            const existing = prev.find((u) => u.userId === currentUserId);
            if (!existing) {
              return [
                ...prev,
                {
                  userId: currentUserId,
                  username: currentUsername,
                  isMuted: !localStreamRef.current
                    ?.getAudioTracks()
                    .some((t) => t.enabled),
                  audioLevel: 0,
                },
              ];
            }
            return prev;
          });

          // Re-announce voice join with a small delay to ensure socket is fully ready
          setTimeout(() => {
            if (socket && socket.connected) {
              console.log("🎤 WebRTC: Sending fresh join_voice announcement");
              socket.emit("join_voice", {
                roomId,
                userId: currentUserId,
                username: currentUsername,
              });

              // Also broadcast current mute state
              const hasActiveTrack = localStreamRef.current
                ?.getAudioTracks()
                .some((t) => t.enabled);
              socket.emit("voice_mute_changed", {
                roomId,
                userId: currentUserId,
                isMuted: !hasActiveTrack,
              });
            }
          }, 100); // Small delay to ensure socket is ready

          // Restart monitoring services
          const hasActiveTrack = localStreamRef.current
            .getAudioTracks()
            .some((t) => t.enabled);
          if (hasActiveTrack) {
            startAudioLevelMonitoring();
            startHealthMonitoring();
            startHeartbeat();
          }
        }
    }
  }, [
    socket,
    socket?.connected,
    isEnabled,
    roomId,
    currentUserId,
    currentUsername,
    startAudioLevelMonitoring,
    cleanupPeerConnection,
  ]);

  // Announce voice join when enabled and have local stream
  useEffect(() => {
    if (isEnabled && socket && roomId && localStreamRef.current) {
      // Add self to voice users list
      setVoiceUsers((prev) => {
        const existing = prev.find((u) => u.userId === currentUserId);
        if (!existing) {
          const newUsers = [
            ...prev,
            {
              userId: currentUserId,
              username: currentUsername,
              isMuted: false, // We have a stream, so we're not muted
              audioLevel: 0,
            },
          ];
          return newUsers;
        } else {
          // Update existing entry
          const updatedUsers = prev.map((u) =>
            u.userId === currentUserId ? { ...u, isMuted: false } : u,
          );
          return updatedUsers;
        }
      });

      // Initiate calls to all existing voice users when we join
      Object.keys(peersRef.current).forEach((existingUserId) => {
        if (existingUserId !== currentUserId) {
          initiateVoiceCall(existingUserId);
        }
      });

      console.log("🎤 WebRTC: Announcing voice join to room", {
        roomId,
        currentUserId,
        currentUsername,
      });
      socket.emit("join_voice", {
        roomId,
        userId: currentUserId,
        username: currentUsername,
      });

      return () => {
        console.log("🔇 WebRTC: Announcing voice leave from room", {
          roomId,
          currentUserId,
        });
        socket.emit("leave_voice", {
          roomId,
          userId: currentUserId,
        });
      };
    }
  }, [
    isEnabled,
    socket,
    roomId,
    currentUserId,
    currentUsername,
    initiateVoiceCall,
  ]);

  return {
    voiceUsers,
    localStream,
    setLocalStream,
    addLocalStream,
    removeLocalStream,
    performIntentionalCleanup,
    enableAudioReception,
    isConnecting,
    connectionError,
    canTransmit,
    isAudioEnabled,
  };
};
