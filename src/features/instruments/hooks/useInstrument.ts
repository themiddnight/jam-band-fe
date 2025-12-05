import { useInstrumentManager } from "./useInstrumentManager";
import { usePerformanceOptimization } from "@/features/audio";
import type { SynthState } from "@/features/instruments";
import {
  DRUM_MACHINES,
  InstrumentCategory,
} from "@/shared/constants/instruments";
import { ControlType } from "@/shared/types";
import { useEffect, useMemo } from "react";

import {
  useInstrumentState,
  type UseInstrumentStateOptions,
} from "./modules/useInstrumentState";
import { useInstrumentAudio } from "./modules/useInstrumentAudio";
import { useInstrumentPlayback } from "./modules/useInstrumentPlayback";
import { useRemoteInstrument } from "./modules/useRemoteInstrument";

export interface UseInstrumentOptions extends UseInstrumentStateOptions {
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
}

export interface UseInstrumentReturn {
  // Current instrument state
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  isLoadingInstrument: boolean;
  isAudioContextReady: boolean;
  audioContextError: string | null;
  needsUserGesture: boolean;
  availableSamples: string[];
  dynamicDrumMachines: typeof DRUM_MACHINES;

  // Synthesizer state
  synthState: SynthState | null;
  isSynthesizerLoaded: boolean;

  // Instrument fallback state
  lastFallbackInstrument: string | null;
  lastFallbackCategory: InstrumentCategory | null;

  // Local instrument controls
  initializeAudioContext: () => Promise<void>;
  handleInstrumentChange: (instrumentName: string) => Promise<void>;
  handleCategoryChange: (category: InstrumentCategory) => Promise<void>;
  getCurrentInstrumentControlType: () => ControlType;

  // Local playback methods
  playNote: (
    notes: string[],
    velocity: number,
    isKeyHeld?: boolean,
  ) => Promise<void>;
  stopNotes: (notes: string[]) => Promise<void>;
  stopSustainedNotes: () => void;
  releaseKeyHeldNote: (note: string) => Promise<void>;
  setSustainState: (sustain: boolean) => void;

  // Synthesizer controls
  updateSynthParams: (params: Partial<SynthState>) => Promise<void>;
  loadPresetParams: (params: SynthState) => Promise<void>;

  // Utility methods
  refreshAvailableSamples: () => void;

  // Remote instrument methods
  playRemoteUserNote: (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld?: boolean,
    sampleNotes?: string[],
  ) => Promise<void>;
  stopRemoteUserNote: (
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory,
  ) => Promise<void>;
  setRemoteUserSustain: (
    userId: string,
    sustain: boolean,
    instrumentName: string,
    category: InstrumentCategory,
  ) => void;
  updateRemoteUserInstrument: (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
  ) => Promise<void>;
  updateRemoteUserSynthParams: (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
    params: Partial<SynthState>,
  ) => Promise<void>;
  cleanupRemoteUser: (userId: string) => void;
  preloadRoomInstruments: (
    instruments: Array<{
      userId: string;
      username: string;
      instrumentName: string;
      category: string;
    }>,
  ) => Promise<void>;

  instrumentManager: any;
}

export const useInstrument = (
  options: UseInstrumentOptions = {},
): UseInstrumentReturn => {
  const { onSynthParamsChange } = options;

  // Unified instrument manager
  const instrumentManager = useInstrumentManager();

  // Performance optimization
  usePerformanceOptimization();

  // 1. State Management
  const state = useInstrumentState(options);
  const {
    currentInstrument,
    currentCategory,
    synthStateUpdateTrigger,
    isAudioContextReady,
    needsUserGesture,
    audioContextError,
    isCurrentlyLoading,
    hasAutoLoadedInitialInstrument,
    setAvailableSamples,
  } = state;

  // 2. Audio Initialization
  const audio = useInstrumentAudio({
    instrumentManager,
    ...state,
    onSynthParamsChange,
  });
  const { initializeAudioContext } = audio;

  // 3. Playback & Controls
  const playback = useInstrumentPlayback({
    instrumentManager,
    state,
    audio,
    onSynthParamsChange,
  });
  const { loadInstrument } = playback;

  // 4. Remote User Handling
  const remote = useRemoteInstrument({ instrumentManager });

  // Synthesizer state tracking
  const synthState = useMemo(() => {
    const localEngine = instrumentManager.getLocalEngine();
    return localEngine ? localEngine.getSynthState() : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentManager, synthStateUpdateTrigger]);

  const isSynthesizerLoaded = useMemo(() => {
    const localEngine = instrumentManager.getLocalEngine();
    return !!(
      localEngine &&
      currentCategory === InstrumentCategory.Synthesizer &&
      localEngine.isReady()
    );
  }, [instrumentManager, currentCategory]);

  // Auto-initialize audio context
  useEffect(() => {
    const autoInit = async () => {
      if (
        !isAudioContextReady &&
        !isCurrentlyLoading.current &&
        !needsUserGesture &&
        !audioContextError
      ) {
        try {
          await initializeAudioContext();
        } catch {
          // Error is already handled in initializeAudioContext
        }
      }
    };

    autoInit();
  }, [
    initializeAudioContext,
    isAudioContextReady,
    needsUserGesture,
    audioContextError,
    isCurrentlyLoading,
  ]);

  // Auto-load initial instrument once audio is ready
  useEffect(() => {
    if (!isAudioContextReady || hasAutoLoadedInitialInstrument.current) {
      return;
    }

    const localEngine = instrumentManager.getLocalEngine();
    if (localEngine?.isReady()) {
      hasAutoLoadedInitialInstrument.current = true;
      return;
    }

    let isCancelled = false;

    const loadInitialInstrument = async () => {
      try {
        await loadInstrument(currentInstrument, currentCategory);
        if (!isCancelled) {
          hasAutoLoadedInitialInstrument.current = true;
        }
      } catch {
        // Error logged
      }
    };

    loadInitialInstrument();

    return () => {
      isCancelled = true;
    };
  }, [
    isAudioContextReady,
    loadInstrument,
    currentInstrument,
    currentCategory,
    instrumentManager,
    hasAutoLoadedInitialInstrument,
  ]);

  // Poll for samples if needed (Drum machine logic)
  useEffect(() => {
    if (
      currentCategory === InstrumentCategory.DrumBeat &&
      isAudioContextReady
    ) {
      const checkSamples = () => {
        const localEngine = instrumentManager.getLocalEngine();
        if (localEngine && localEngine.isReady()) {
          const actualSamples = instrumentManager.getLocalAvailableSamples();
          if (actualSamples.length > 0) {
            setAvailableSamples((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(actualSamples)) {
                return actualSamples;
              }
              return prev;
            });
            return true;
          }
        }
        return false;
      };

      if (!checkSamples()) {
        const pollInterval = setInterval(() => {
          if (checkSamples()) {
            clearInterval(pollInterval);
          }
        }, 100);

        const timeout = setTimeout(() => {
          clearInterval(pollInterval);
          // Fallback samples handled in loadInstrument/playback
        }, 5000);

        return () => {
          clearInterval(pollInterval);
          clearTimeout(timeout);
        };
      }
    }
  }, [
    currentCategory,
    currentInstrument,
    isAudioContextReady,
    instrumentManager,
    setAvailableSamples,
  ]);

  return {
    // State
    currentInstrument: state.currentInstrument,
    currentCategory: state.currentCategory,
    isLoadingInstrument: state.isLoadingInstrument,
    isAudioContextReady: state.isAudioContextReady,
    audioContextError: state.audioContextError,
    needsUserGesture: state.needsUserGesture,
    availableSamples: state.availableSamples,
    dynamicDrumMachines: state.dynamicDrumMachines,

    // Synth
    synthState,
    isSynthesizerLoaded,

    // Fallback
    lastFallbackInstrument: state.lastFallbackInstrument,
    lastFallbackCategory: state.lastFallbackCategory,

    // Audio
    initializeAudioContext,

    // Playback
    handleInstrumentChange: playback.handleInstrumentChange,
    handleCategoryChange: playback.handleCategoryChange,
    getCurrentInstrumentControlType: playback.getCurrentInstrumentControlType,
    playNote: playback.playNote,
    stopNotes: playback.stopNotes,
    stopSustainedNotes: playback.stopSustainedNotes,
    releaseKeyHeldNote: playback.releaseKeyHeldNote,
    setSustainState: playback.setSustainState,
    updateSynthParams: playback.updateSynthParams,
    loadPresetParams: playback.loadPresetParams,
    refreshAvailableSamples: playback.refreshAvailableSamples,

    // Remote
    ...remote,

    // Manager
    instrumentManager,
  };
};
