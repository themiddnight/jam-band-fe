import { useCallback, useEffect } from "react";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { InstrumentCategory } from "@/shared/constants/instruments";
import type { SynthState } from "@/features/instruments";
import type {
  SynthParamsData,
  NewUserSynthParamsData,
} from "@/features/audio/hooks/useRoomSocket";

// --- Interface Definitions ---

export interface RoomState {
  connectionState: ConnectionState;
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  userId: string | null;
  currentUser: any;
  synthState: SynthState | null;
  isSynthesizerLoaded: boolean;
  hasInitialInstrumentSent: React.MutableRefObject<boolean>;
}

export interface RoomActions {
  changeInstrument: (instrument: string, category: string) => void;
  updateSynthParams: (params: any) => void;
  updateRemoteUserSynthParams: (
    userId: string,
    username: string,
    instrument: string,
    category: InstrumentCategory,
    params: any,
  ) => void;
  updateRemoteUserInstrument: (
    userId: string,
    username: string,
    instrument: string,
    category: InstrumentCategory,
  ) => void;
  stopRemoteUserNote: (
    userId: string,
    notes: string[],
    instrument: string,
    category: InstrumentCategory,
  ) => void;
}

export interface RoomEvents {
  onSynthParamsChanged: any;
  onRequestSynthParamsResponse: any;
  onAutoSendSynthParamsToNewUser: any;
  onSendCurrentSynthParamsToNewUser: any;
  onRequestCurrentSynthParamsForNewUser: any;
  onSendSynthParamsToNewUserNow: any;
  onInstrumentChanged: any;
  onStopAllNotes: any;
}

interface UseRoomSocketHandlersProps {
  state: RoomState;
  actions: RoomActions;
  events: RoomEvents;
}

// --- Helper Hook for Synth Params Sync ---
const useSynthParamsSync = (
  state: RoomState,
  actions: RoomActions,
  events: RoomEvents
) => {
  const { currentCategory, synthState, userId } = state;
  const { updateSynthParams } = actions;

  const syncSynthParams = useCallback(() => {
    if (
      currentCategory === InstrumentCategory.Synthesizer &&
      synthState &&
      Object.keys(synthState).length > 0
    ) {
      updateSynthParams(synthState);
    }
  }, [currentCategory, synthState, updateSynthParams]);

  const syncSynthParamsIfUserMatch = useCallback(
    (data: NewUserSynthParamsData) => {
      if (data.synthUserId === userId) {
        syncSynthParams();
      }
    },
    [userId, syncSynthParams]
  );

  // 1. Standard requests
  useEffect(() => {
    const unsubscribe1 = events.onRequestSynthParamsResponse(syncSynthParams);
    const unsubscribe2 = events.onAutoSendSynthParamsToNewUser(syncSynthParams);
    const unsubscribe3 = events.onSendCurrentSynthParamsToNewUser(syncSynthParams);
    
    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [
    events,
    syncSynthParams
  ]);

  // 2. User-specific requests
  useEffect(() => {
    const unsubscribe1 = events.onRequestCurrentSynthParamsForNewUser(syncSynthParamsIfUserMatch);
    const unsubscribe2 = events.onSendSynthParamsToNewUserNow(syncSynthParamsIfUserMatch);

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [
    events,
    syncSynthParamsIfUserMatch
  ]);
};

export const useRoomSocketHandlers = ({
  state,
  actions,
  events,
}: UseRoomSocketHandlersProps) => {
  const {
    connectionState,
    currentInstrument,
    currentCategory,
    userId,
    currentUser,
    synthState,
    isSynthesizerLoaded,
    hasInitialInstrumentSent,
  } = state;

  const {
    changeInstrument,
    updateSynthParams,
    updateRemoteUserSynthParams,
    updateRemoteUserInstrument,
    stopRemoteUserNote,
  } = actions;

  const {
    onInstrumentChanged,
    onStopAllNotes,
    onSynthParamsChanged,
  } = events;

  // --- Instrument Change Handlers ---

  const handleInstrumentChanged = useCallback(
    (data: {
      userId: string;
      username: string;
      instrument: string;
      category: string;
    }) => {
      // Stop all notes for this remote user before updating their instrument
      if (data.userId !== userId) {
        stopRemoteUserNote(
          data.userId,
          [],
          data.instrument,
          data.category as any,
        );
      }

      // Update the remote user's instrument
      updateRemoteUserInstrument(
        data.userId,
        data.username,
        data.instrument,
        data.category as any,
      );
    },
    [userId, updateRemoteUserInstrument, stopRemoteUserNote],
  );

  const handleStopAllNotes = useCallback(
    (data: {
      userId: string;
      username: string;
      instrument: string;
      category: string;
    }) => {
      // Stop all notes for the remote user
      if (data.userId !== userId) {
        stopRemoteUserNote(
          data.userId,
          [],
          data.instrument,
          data.category as any,
        );
      }
    },
    [userId, stopRemoteUserNote],
  );

  // Setup Instrument Listeners
  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) return;
    const unsubscribe = onInstrumentChanged(handleInstrumentChanged);
    return unsubscribe;
  }, [onInstrumentChanged, connectionState, handleInstrumentChanged]);

  useEffect(() => {
    if (connectionState !== ConnectionState.IN_ROOM) return;
    const unsubscribe = onStopAllNotes(handleStopAllNotes);
    return unsubscribe;
  }, [onStopAllNotes, connectionState, handleStopAllNotes]);

  // --- Auto Send Instrument Handlers ---

  useEffect(() => {
    if (
      connectionState !== ConnectionState.IN_ROOM ||
      !currentInstrument ||
      !currentCategory ||
      currentUser?.role === "audience"
    ) {
      return;
    }

    if (
      currentCategory === InstrumentCategory.Synthesizer &&
      !isSynthesizerLoaded
    ) {
      return;
    }

    if (hasInitialInstrumentSent.current) {
      return;
    }

    if (!currentUser?.currentInstrument || !currentUser?.currentCategory) {
      changeInstrument(currentInstrument, currentCategory);

      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }

      hasInitialInstrumentSent.current = true;
    } else {
      hasInitialInstrumentSent.current = true;
    }
  }, [
    connectionState,
    currentInstrument,
    currentCategory,
    currentUser,
    changeInstrument,
    isSynthesizerLoaded,
    synthState,
    updateSynthParams,
    hasInitialInstrumentSent,
  ]);

  // --- Synth Params Handlers ---

  // 1. Listen for remote synth params changes
  useEffect(() => {
    const unsubscribe = onSynthParamsChanged((data: SynthParamsData) => {
      try {
        updateRemoteUserSynthParams(
          data.userId,
          data.username,
          data.instrument,
          data.category as InstrumentCategory,
          data.params,
        );
      } catch (error) {
        // Keep error log for debugging critical issues
        console.error("❌ Failed to update remote synth params:", error);
      }
    });
    return unsubscribe;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams]);

  // 2. Sync local synth params using the helper hook
  useSynthParamsSync(state, actions, events);
};
