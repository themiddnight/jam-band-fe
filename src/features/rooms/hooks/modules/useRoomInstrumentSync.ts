import { useCallback } from "react";
import { useSequencerStore } from "@/features/sequencer";
import { trackInstrumentSelected } from "@/shared/analytics/events";
import { InstrumentCategory } from "@/shared/constants/instruments";
import type { RoomContext } from "@/shared/analytics/events";

interface UseRoomInstrumentSyncProps {
  isConnected: boolean;
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  synthState: any;
  stopAllNotes: (instrument: string, category: string) => void;
  handleInstrumentChange: (instrument: string) => Promise<void>;
  changeInstrument: (instrument: string, category: string) => void;
  updateSynthParams: (params: any) => void;
  handleCategoryChange: (category: InstrumentCategory) => Promise<void>;
  instrumentUpdateSynthParams: (params: any) => void;
  analyticsRoomContextRef: React.MutableRefObject<RoomContext>;
}

export const useRoomInstrumentSync = ({
  isConnected,
  currentInstrument,
  currentCategory,
  synthState,
  stopAllNotes,
  handleInstrumentChange,
  changeInstrument,
  updateSynthParams,
  handleCategoryChange,
  instrumentUpdateSynthParams,
  analyticsRoomContextRef,
}: UseRoomInstrumentSyncProps) => {
  const sequencerStore = useSequencerStore();

  // Instrument change handlers
  const handleInstrumentChangeWrapper = useCallback(
    async (instrument: string) => {
      console.log(
        "🎵 Instrument change wrapper called:",
        instrument,
        "category:",
        currentCategory,
        "currentInstrument:",
        currentInstrument,
      );

      // Check if instrument actually changed - prevent redundant emissions
      if (instrument === currentInstrument) {
        console.log("🎵 Skipping instrument change - no actual change detected");
        return;
      }

      // Stop all notes before switching instruments
      if (isConnected) {
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        sequencerStore.hardStop();
      }

      await handleInstrumentChange(instrument);
      if (isConnected) {
        console.log(
          "🎵 Sending instrument change to remote users:",
          instrument,
          currentCategory,
        );
        changeInstrument(instrument, currentCategory);

        // Send current synth parameters as preset for the new instrument
        console.log(
          "🎛️ Sending current synth preset for new instrument:",
          instrument,
        );

        if (synthState && Object.keys(synthState).length > 0) {
          updateSynthParams(synthState);
        }
      }

      const ctx = analyticsRoomContextRef.current;
      if (ctx.roomId) {
        trackInstrumentSelected(ctx, instrument, currentCategory ?? "unknown");
      }
    },
    [
      handleInstrumentChange,
      isConnected,
      changeInstrument,
      currentCategory,
      synthState,
      updateSynthParams,
      sequencerStore,
      stopAllNotes,
      currentInstrument,
      analyticsRoomContextRef,
    ],
  );

  const handleCategoryChangeWrapper = useCallback(
    (category: string) => {
      // Stop all notes before changing category
      if (isConnected) {
        stopAllNotes(currentInstrument, currentCategory);
      }

      // Stop sequencer playback if it's playing
      if (sequencerStore.isPlaying) {
        sequencerStore.hardStop();
      }

      handleCategoryChange(category as any);
      // Don't send remote change here - let the subsequent instrument change handle it
      // The local category change will trigger an instrument change to the default instrument
      // of that category, and handleInstrumentChangeWrapper will send the correct instrument
      console.log(
        "🎵 Category changed locally, waiting for instrument change to sync to remote",
      );
    },
    [
      handleCategoryChange,
      isConnected,
      stopAllNotes,
      currentInstrument,
      currentCategory,
      sequencerStore,
    ],
  );

  // Synth parameter update
  const updateSynthParamsWrapper = useCallback(
    (params: any) => {
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - sending synth params to remote users:",
          params,
        );
        updateSynthParams(params);
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams],
  );

  // Broadcast full preset parameters as well
  const loadPresetParamsWrapper = useCallback(
    (params: any) => {
      instrumentUpdateSynthParams(params);
      if (isConnected) {
        console.log(
          "🎛️ Connected - broadcasting preset synth params to remote users",
        );
        updateSynthParams(params);
      }
    },
    [instrumentUpdateSynthParams, isConnected, updateSynthParams],
  );

  return {
    handleInstrumentChangeWrapper,
    handleCategoryChangeWrapper,
    updateSynthParamsWrapper,
    loadPresetParamsWrapper,
  };
};
