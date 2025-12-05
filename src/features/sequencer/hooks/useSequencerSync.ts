import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { debounce } from "lodash";
import type { RefObject } from "react";
import { SequencerService } from "../services/SequencerService";
import { MetronomeSocketService } from "@/features/metronome/services/MetronomeSocketService";
import { useSequencerStore } from "../stores/sequencerStore";
import type { SequencerSpeed, SequencerBank } from "../types";
import { useEvent } from "@/shared/hooks/useEvent";

interface UseSequencerSyncProps {
  socket: Socket | null;
  sequencerServiceRef: RefObject<SequencerService | null>;
  currentBPMRef: RefObject<number>;
  onBeatChange: (beat: number) => void;
  onPlayStep: (steps: any[]) => void;
  banks: Record<string, SequencerBank>;
  currentBank: string;
}

export const useSequencerSync = ({
  socket,
  sequencerServiceRef,
  currentBPMRef,
  onBeatChange,
  onPlayStep,
  banks,
  currentBank
}: UseSequencerSyncProps) => {
  const metronomeServiceRef = useRef<MetronomeSocketService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentBPM, setCurrentBPM] = useState(120);
  
  // Use useEvent for callbacks to avoid re-initializing service
  const onBeatChangeStable = useEvent(onBeatChange);
  const onPlayStepStable = useEvent(onPlayStep);

  useEffect(() => {
    currentBPMRef.current = currentBPM;
  }, [currentBPM, currentBPMRef]);

  // Initialize services - only once
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize sequencer service
        sequencerServiceRef.current = new SequencerService({
          onBeatChange: onBeatChangeStable,
          onPlayStep: onPlayStepStable,
          onMetronomeSync: () => {
            useSequencerStore.getState().setWaitingForMetronome(false);
          },
          onError: (errorMessage) => {
            setError(errorMessage);
            console.error("Sequencer error:", errorMessage);
          },
        });

        await sequencerServiceRef.current.initialize();

        // Initialize metronome service if socket is available
        if (socket) {
          metronomeServiceRef.current = new MetronomeSocketService(socket);
        } else {
          console.warn("Metronome socket unavailable; skipping service initialization");
        }

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        const errorMessage = `Failed to initialize sequencer: ${err}`;
        setError(errorMessage);
        console.error(errorMessage);
      }
    };

    initializeServices();

    return () => {
      if (sequencerServiceRef.current) {
        sequencerServiceRef.current.dispose();
        sequencerServiceRef.current = null;
      }
      if (metronomeServiceRef.current) {
        metronomeServiceRef.current.removeListeners();
        metronomeServiceRef.current = null;
      }
    };
  }, [socket, sequencerServiceRef, onBeatChangeStable, onPlayStepStable]);

  // Debounced service update
  const debouncedServiceUpdate = useRef(
    debounce((bpm: number, speed: SequencerSpeed, length: number) => {
      if (sequencerServiceRef.current && bpm > 0) {
        sequencerServiceRef.current.updateSettings(bpm, speed, length);
      }
    }, 100, { 
      leading: false,
      trailing: true,
      maxWait: 300
    })
  );

  // Listen to metronome updates
  useEffect(() => {
    if (!metronomeServiceRef.current || !sequencerServiceRef.current || !isInitialized) return;

    const cleanupMetronomeState = metronomeServiceRef.current.onMetronomeState(
      ({ bpm }) => {
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          const { speed, length } = useSequencerStore.getState().settings;
          sequencerServiceRef.current.updateSettings(bpm, speed, length);
        }
      }
    );

    const cleanupMetronomeTick = metronomeServiceRef.current.onMetronomeTick(
      ({ timestamp, bpm }) => {
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          sequencerServiceRef.current.syncWithMetronome(timestamp, bpm);
        }
      }
    );

    const cleanupMetronomeUpdated = metronomeServiceRef.current.onMetronomeUpdated(
      ({ bpm }) => {
        setCurrentBPM(bpm);
        if (sequencerServiceRef.current) {
          const { speed, length } = useSequencerStore.getState().settings;
          sequencerServiceRef.current.updateSettings(bpm, speed, length);
        }
      }
    );

    metronomeServiceRef.current.requestMetronomeState();

    return () => {
      cleanupMetronomeState();
      cleanupMetronomeTick();
      cleanupMetronomeUpdated();
    };
  }, [isInitialized, sequencerServiceRef]);

  // Update sequencer service when steps change
  useEffect(() => {
    if (sequencerServiceRef.current && isInitialized) {
      const bank = banks[currentBank];
      if (bank) {
        sequencerServiceRef.current.setSteps(bank.steps);
      }
    }
  }, [isInitialized, banks, currentBank, sequencerServiceRef]); 
  
  return {
    isInitialized,
    error,
    currentBPM,
    debouncedServiceUpdate
  };
};
