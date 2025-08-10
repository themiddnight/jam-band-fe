import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Socket } from "socket.io-client";

interface RTCPeerMap {
  [userId: string]: {
    connection: RTCPeerConnection;
    audioElement: HTMLAudioElement;
    isConnected: boolean;
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

  // Grace period duration (should match backend)
  const GRACE_PERIOD_MS = 60000; // 60 seconds

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

        if (state === "failed" || state === "disconnected") {
          setConnectionError(`Connection with ${userId} failed`);
          cleanupPeerConnection(userId);
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
  }, [stopAudioLevelMonitoring, currentUserId]);

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

    return () => {
      socket.off("voice_offer", handleVoiceOffer);
      socket.off("voice_answer", handleVoiceAnswer);
      socket.off("voice_ice_candidate", handleVoiceIceCandidate);
      socket.off("user_joined_voice", handleUserJoinedVoice);
      socket.off("user_left_voice", handleUserLeftVoice);
      socket.off("voice_mute_changed", handleVoiceMuteChanged);
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
  ]);

  // Cleanup on unmount or when disabled
  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      removeLocalStream();
      Object.keys(peers).forEach(cleanupPeerConnection);
      stopAudioLevelMonitoring();

      // Clear grace period timeout if it exists
      if (gracePeriodTimeoutRef.current) {
        clearTimeout(gracePeriodTimeoutRef.current);
        gracePeriodTimeoutRef.current = null;
      }

      // Optional: close audio context if created
      // Note: keeping it open can be beneficial to avoid resume glitches
    };
  }, [removeLocalStream, cleanupPeerConnection, stopAudioLevelMonitoring]);

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
    localAnalyserRef.current = null;
    localSourceRef.current = null;
  }, [cleanupPeerConnection, stopAudioLevelMonitoring]);

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

        // Restart audio level monitoring if stream is unmuted
        const hasActiveTrack = localStreamRef.current
          .getAudioTracks()
          .some((t) => t.enabled);
        if (hasActiveTrack) {
          startAudioLevelMonitoring();
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
