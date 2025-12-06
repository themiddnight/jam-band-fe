import { useCallback, useRef, useEffect } from "react";
import { useSequencerStore } from "../stores/sequencerStore";
import type { MutableRefObject } from "react";
import { SequencerService } from "../services/SequencerService";

interface UseSequencerPlaybackProps {
  sequencerServiceRef: MutableRefObject<SequencerService | null>;
  isInitialized: boolean;
  currentlyPlayingNotesRef: MutableRefObject<Set<string>>;
  hasStartedPlayingRef: MutableRefObject<boolean>;
  onStopNotes: (notes: string[]) => void;
}

export const useSequencerPlayback = ({
  sequencerServiceRef,
  isInitialized,
  currentlyPlayingNotesRef,
  hasStartedPlayingRef,
  onStopNotes
}: UseSequencerPlaybackProps) => {
  const sequencerStoreRef = useRef(useSequencerStore.getState());
  const onStopNotesRef = useRef(onStopNotes);

  useEffect(() => {
    const unsubscribe = useSequencerStore.subscribe((state) => {
      sequencerStoreRef.current = state;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    onStopNotesRef.current = onStopNotes;
  }, [onStopNotes]);

  const handlePlay = useCallback(async () => {
    if (!sequencerServiceRef.current || !isInitialized) {
      console.log("🎵 Play blocked - service not ready:", { 
        hasService: !!sequencerServiceRef.current, 
        isInitialized 
      });
      return;
    }

    try {
      // Reset playhead to beat 0 (first column) for consistent start
      sequencerStoreRef.current.setCurrentBeat(0);
      // Reset for fresh start
      hasStartedPlayingRef.current = false;
      // Mark UI state as playing and waiting for metronome
      sequencerStoreRef.current.play();
      // Schedule start to happen on the next websocket tick for alignment
      sequencerServiceRef.current.scheduleStartOnNextTick();
      // Initialize service state (manual mode sets isPlaying and waits for tick)
      await sequencerServiceRef.current.startPlayback();
    } catch (err) {
      const errorMessage = `Failed to start playback: ${err}`;
      console.error(errorMessage);
    }
  }, [isInitialized, sequencerServiceRef, hasStartedPlayingRef]);

  const handleStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    // Stop all currently playing notes to prevent stuck notes
    const playingNotes = Array.from(currentlyPlayingNotesRef.current);
    if (playingNotes.length > 0) {
      onStopNotesRef.current(playingNotes);
      currentlyPlayingNotesRef.current.clear();
    }

    // Additional safety: Stop ALL possible notes to prevent phantom/stuck notes
    setTimeout(() => {
      const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
      if (remainingNotes.length > 0) {
        console.warn(`🎵 Stop: emergency cleanup of ${remainingNotes.length} remaining notes:`, remainingNotes);
        onStopNotesRef.current(remainingNotes);
        currentlyPlayingNotesRef.current.clear();
      }
    }, 100);

    hasStartedPlayingRef.current = false; // Reset for next playback
    sequencerStoreRef.current.stop();
    sequencerServiceRef.current.stopPlayback();
  }, [sequencerServiceRef, currentlyPlayingNotesRef, hasStartedPlayingRef]);

  const handleSoftStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;
    sequencerStoreRef.current.softStop();
  }, [sequencerServiceRef]);

  const handleCancelSoftStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;
    sequencerStoreRef.current.cancelSoftStop();
  }, [sequencerServiceRef]);

  const handleHardStop = useCallback(() => {
    if (!sequencerServiceRef.current) return;

    // Stop all currently playing notes immediately
    const playingNotes = Array.from(currentlyPlayingNotesRef.current);
    if (playingNotes.length > 0) {
      onStopNotesRef.current(playingNotes);
      currentlyPlayingNotesRef.current.clear();
    }

    // Additional safety: Multiple emergency stops
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const remainingNotes = Array.from(currentlyPlayingNotesRef.current);
        if (remainingNotes.length > 0) {
          console.warn(`🎵 Hard-stop: emergency cleanup ${i + 1}/3 of ${remainingNotes.length} remaining notes:`, remainingNotes);
          onStopNotesRef.current(remainingNotes);
          currentlyPlayingNotesRef.current.clear();
        }
      }, (i + 1) * 50);
    }

    hasStartedPlayingRef.current = false; // Reset for next playback
    sequencerStoreRef.current.hardStop();
    sequencerServiceRef.current.stopPlayback();
  }, [sequencerServiceRef, currentlyPlayingNotesRef, hasStartedPlayingRef]);

  const handlePause = useCallback(() => {
    handleSoftStop();
  }, [handleSoftStop]);

  const handleTogglePlayback = useCallback(() => {
    if (sequencerStoreRef.current.isPlaying) {
      if (sequencerStoreRef.current.softStopRequested) {
        handleCancelSoftStop();
      } else {
        handleSoftStop();
      }
    } else {
      handlePlay();
    }
  }, [handlePlay, handleSoftStop, handleCancelSoftStop]);

  return {
    handlePlay,
    handleStop,
    handleSoftStop,
    handleCancelSoftStop,
    handleHardStop,
    handlePause,
    handleTogglePlayback
  };
};
