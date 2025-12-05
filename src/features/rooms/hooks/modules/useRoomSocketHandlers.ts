import { useCallback, useEffect } from "react";
import { ConnectionState } from "@/features/audio/types/connectionState";
import { InstrumentCategory } from "@/shared/constants/instruments";
import type { SynthState } from "@/features/instruments";
import type {
  SynthParamsData,
  NewUserSynthParamsData,
} from "@/features/audio/hooks/useRoomSocket";

interface UseRoomSocketHandlersProps {
  connectionState: ConnectionState;
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  userId: string | null;
  currentUser: any;
  synthState: SynthState | null;
  isSynthesizerLoaded: boolean;
  hasInitialInstrumentSent: React.MutableRefObject<boolean>;
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
  onSynthParamsChanged: any;
  onRequestSynthParamsResponse: any;
  onAutoSendSynthParamsToNewUser: any;
  onSendCurrentSynthParamsToNewUser: any;
  onRequestCurrentSynthParamsForNewUser: any;
  onSendSynthParamsToNewUserNow: any;
  onInstrumentChanged: any;
  onStopAllNotes: any;
}

export const useRoomSocketHandlers = ({
  connectionState,
  currentInstrument,
  currentCategory,
  userId,
  currentUser,
  synthState,
  isSynthesizerLoaded,
  hasInitialInstrumentSent,
  changeInstrument,
  updateSynthParams,
  updateRemoteUserSynthParams,
  updateRemoteUserInstrument,
  stopRemoteUserNote,
  onSynthParamsChanged,
  onRequestSynthParamsResponse,
  onAutoSendSynthParamsToNewUser,
  onSendCurrentSynthParamsToNewUser,
  onRequestCurrentSynthParamsForNewUser,
  onSendSynthParamsToNewUserNow,
  onInstrumentChanged,
  onStopAllNotes,
}: UseRoomSocketHandlersProps) => {
  
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
      console.log(
        "🎵 Automatically sending current instrument preferences to server:",
        {
          instrument: currentInstrument,
          category: currentCategory,
          userRole: currentUser?.role,
        },
      );

      changeInstrument(currentInstrument, currentCategory);

      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        console.log(
          "🎛️ Automatically sending restored synth params to server",
        );
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
        console.error("❌ Failed to update remote synth params:", error);
      }
    });
    return unsubscribe;
  }, [onSynthParamsChanged, updateRemoteUserSynthParams]);

  useEffect(() => {
    const unsubscribe = onRequestSynthParamsResponse(() => {
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });
    return unsubscribe;
  }, [
    onRequestSynthParamsResponse,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  useEffect(() => {
    const unsubscribe = onAutoSendSynthParamsToNewUser(() => {
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });
    return unsubscribe;
  }, [
    onAutoSendSynthParamsToNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  useEffect(() => {
    const unsubscribe = onSendCurrentSynthParamsToNewUser(() => {
      if (
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });
    return unsubscribe;
  }, [
    onSendCurrentSynthParamsToNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
  ]);

  useEffect(() => {
    const unsubscribe = onRequestCurrentSynthParamsForNewUser((data: NewUserSynthParamsData) => {
      if (
        data.synthUserId === userId &&
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });
    return unsubscribe;
  }, [
    onRequestCurrentSynthParamsForNewUser,
    currentCategory,
    synthState,
    updateSynthParams,
    userId,
  ]);

  useEffect(() => {
    const unsubscribe = onSendSynthParamsToNewUserNow((data: NewUserSynthParamsData) => {
      if (
        data.synthUserId === userId &&
        currentCategory === InstrumentCategory.Synthesizer &&
        synthState &&
        Object.keys(synthState).length > 0
      ) {
        updateSynthParams(synthState);
      }
    });
    return unsubscribe;
  }, [
    onSendSynthParamsToNewUserNow,
    currentCategory,
    synthState,
    updateSynthParams,
    userId,
  ]);
};
