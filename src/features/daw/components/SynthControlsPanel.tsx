import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrackStore } from "../stores/trackStore";
import { trackInstrumentRegistry } from "../utils/trackInstrumentRegistry";
import { InstrumentCategory } from "@/shared/constants/instruments";
import { LazySynthControlsWrapper as SynthControls } from "@/features/instruments";
import type { SynthState } from "@/features/instruments/utils/InstrumentEngine";

/**
 * SynthControlsPanel - Shows synth controls when a MIDI track with synth instrument is selected
 * Placed between RegionEditor and VirtualInstrumentPanel in ArrangeRoom
 */
export const SynthControlsPanel = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);

  const selectedTrack = useMemo(() => {
    if (!selectedTrackId) return null;
    return tracks.find((track) => track.id === selectedTrackId) ?? null;
  }, [selectedTrackId, tracks]);

  const [synthState, setSynthState] = useState<SynthState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if the selected track is a synth track
  const isSynthTrack = useMemo(() => {
    return (
      selectedTrack?.type === "midi" &&
      selectedTrack?.instrumentCategory === InstrumentCategory.Synthesizer
    );
  }, [selectedTrack]);

  // Load synth state when track changes
  useEffect(() => {
    if (!selectedTrack || !isSynthTrack) {
      setSynthState(null);
      return;
    }

    setIsLoading(true);

    const loadSynthState = async () => {
      try {
        const { engine } = await trackInstrumentRegistry.ensureEngine(selectedTrack, {
          instrumentId: selectedTrack.instrumentId,
          instrumentCategory: selectedTrack.instrumentCategory,
        });

        const state = engine.getSynthState();
        setSynthState(state);
      } catch (error) {
        console.error("Failed to load synth state", error);
        setSynthState(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSynthState();
  }, [selectedTrack, isSynthTrack]);

  // Handle synth parameter changes
  const handleParamChange = useCallback(
    async (params: Partial<SynthState>) => {
      if (!selectedTrack || !isSynthTrack) return;

      try {
        const engine = trackInstrumentRegistry.getEngine(selectedTrack.id);
        if (!engine) {
          console.warn("Engine not found for track", selectedTrack.id);
          return;
        }

        // Update the engine with new parameters
        await engine.updateSynthParams(params);

        // Update local state
        setSynthState((prev) => (prev ? { ...prev, ...params } : null));
      } catch (error) {
        console.error("Failed to update synth parameters", error);
      }
    },
    [selectedTrack, isSynthTrack],
  );

  // Handle preset loading
  const handleLoadPreset = useCallback(
    async (presetParams: SynthState) => {
      if (!selectedTrack || !isSynthTrack) return;

      try {
        const engine = trackInstrumentRegistry.getEngine(selectedTrack.id);
        if (!engine) {
          console.warn("Engine not found for track", selectedTrack.id);
          return;
        }

        // Update the engine with preset parameters
        await engine.updateSynthParams(presetParams);

        // Update local state
        setSynthState(presetParams);
      } catch (error) {
        console.error("Failed to load preset", error);
      }
    },
    [selectedTrack, isSynthTrack],
  );

  // Don't render if not a synth track
  if (!isSynthTrack || !selectedTrack) {
    return null;
  }

  // Show loading state
  if (isLoading || !synthState) {
    return (
      <section className="flex flex-col items-center justify-center rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-md" />
          <span className="text-sm text-base-content/70">Loading synth controls...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 shadow-sm overflow-auto">
      <SynthControls
        currentInstrument={selectedTrack.instrumentId ?? "analog_mono"}
        synthState={synthState}
        onParamChange={handleParamChange}
        onLoadPreset={handleLoadPreset}
      />
    </section>
  );
};

export default SynthControlsPanel;
