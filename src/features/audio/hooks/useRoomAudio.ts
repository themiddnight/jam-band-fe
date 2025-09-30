import {
  RoomAudioManager,
  type RoomUser,
} from "../services/RoomAudioManager";
import { ConnectionState } from "../types/connectionState";
import { useRef, useCallback, useEffect } from "react";
import type {
  EffectChainState,
  EffectChainType,
} from "@/shared/types";

export interface UseRoomAudioOptions {
  connectionState: ConnectionState;
  instrumentManager?: any;
}

export interface UseRoomAudioReturn {
  roomAudioManager: RoomAudioManager | null;
  initializeForRoom: (roomUsers: RoomUser[]) => Promise<void>;
  handleUserInstrumentChange: (
    userId: string,
    username: string,
    instrument: string,
    category: string,
  ) => Promise<void>;
  handleUserLeft: (userId: string) => void;
  isAudioContextReady: () => boolean;
  applyUserEffectChains: (
    userId: string,
    chains?: Record<EffectChainType, EffectChainState>,
    username?: string,
    options?: { applyToMixer?: boolean },
  ) => Promise<void>;
  cleanup: () => void;
}

/**
 * Hook for managing room audio initialization and instrument preloading
 * Implements requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
 */
export const useRoomAudio = ({
  connectionState,
  instrumentManager,
}: UseRoomAudioOptions): UseRoomAudioReturn => {
  const roomAudioManagerRef = useRef<RoomAudioManager | null>(null);

  // Initialize room audio manager
  useEffect(() => {
    if (!roomAudioManagerRef.current) {
      roomAudioManagerRef.current = new RoomAudioManager(instrumentManager);
    }

    // Update instrument manager reference if it changes
    if (instrumentManager && roomAudioManagerRef.current) {
      roomAudioManagerRef.current.setInstrumentManager(instrumentManager);
    }
  }, [instrumentManager]);

  // Clean up when leaving room - Requirement 10.4
  useEffect(() => {
    if (
      connectionState !== ConnectionState.IN_ROOM &&
      roomAudioManagerRef.current
    ) {
      roomAudioManagerRef.current.cleanup();
    }
  }, [connectionState]);

  // Initialize audio for room - Requirements 10.1, 10.2
  const initializeForRoom = useCallback(
    async (roomUsers: RoomUser[]) => {
      if (!roomAudioManagerRef.current) {
        console.error("❌ RoomAudioManager not initialized");
        return;
      }

      try {
        await roomAudioManagerRef.current.initializeForRoom(
          roomUsers,
          instrumentManager,
        );
      } catch (error) {
        console.error("❌ Failed to initialize room audio:", error);
        throw error;
      }
    },
    [instrumentManager],
  );

  // Handle user instrument change - Requirement 10.3
  const handleUserInstrumentChange = useCallback(
    async (
      userId: string,
      username: string,
      instrument: string,
      category: string,
    ) => {
      if (!roomAudioManagerRef.current) {
        console.warn(
          "⚠️ RoomAudioManager not initialized for instrument change",
        );
        return;
      }

      try {
        await roomAudioManagerRef.current.handleUserInstrumentChange(
          userId,
          username,
          instrument,
          category,
        );
      } catch (error) {
        console.error("❌ Failed to handle user instrument change:", error);
        // Don't throw - this shouldn't block the UI
      }
    },
    [],
  );

  // Handle user left - Requirement 10.4
  const handleUserLeft = useCallback((userId: string) => {
    if (!roomAudioManagerRef.current) {
      return;
    }

    roomAudioManagerRef.current.handleUserLeft(userId);
  }, []);

  const applyUserEffectChains = useCallback(
    async (
      userId: string,
      chains?: Record<EffectChainType, EffectChainState>,
      username?: string,
      options?: { applyToMixer?: boolean },
    ) => {
      if (!roomAudioManagerRef.current) {
        console.warn("⚠️ RoomAudioManager not initialized for effect chain sync");
        return;
      }

      try {
        await roomAudioManagerRef.current.applyUserEffectChains(
          userId,
          chains,
          username,
          options,
        );
      } catch (error) {
        console.error("❌ Failed to apply user effect chains:", error);
      }
    },
    [],
  );

  // Check if audio context is ready
  const isAudioContextReady = useCallback(() => {
    return roomAudioManagerRef.current?.isAudioContextReady() ?? false;
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (roomAudioManagerRef.current) {
      roomAudioManagerRef.current.cleanup();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    roomAudioManager: roomAudioManagerRef.current,
    initializeForRoom,
    handleUserInstrumentChange,
    handleUserLeft,
    isAudioContextReady,
    applyUserEffectChains,
    cleanup,
  };
};
