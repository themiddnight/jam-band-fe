import { useInstrumentManager } from "./useInstrumentManager";
import { useInstrumentPreferencesStore } from "@/features/audio";
import { usePerformanceOptimization } from "@/features/audio";
import type { SynthState } from "@/features/instruments";
import { getCachedDrumMachines } from "@/features/instruments";
import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
  InstrumentCategory,
} from "@/shared/constants/instruments";
import { ControlType } from "@/shared/types";
import { isSafari } from "@/shared/utils/webkitCompat";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export interface UseInstrumentOptions {
  initialInstrument?: string;
  initialCategory?: InstrumentCategory;
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

  // Synthesizer state (for current local instrument)
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

  // Synthesizer controls (local only)
  updateSynthParams: (params: Partial<SynthState>) => Promise<void>;
  loadPresetParams: (params: SynthState) => Promise<void>;

  // Utility methods
  refreshAvailableSamples: () => void;

  // Remote instrument methods (for multi-user functionality)
  playRemoteUserNote: (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld?: boolean,
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

  // Instrument manager for room audio integration - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
  instrumentManager: any;
}

export const useInstrument = (
  options: UseInstrumentOptions = {},
): UseInstrumentReturn => {
  const {
    initialInstrument,
    initialCategory = InstrumentCategory.Melodic,
    onSynthParamsChange,
  } = options;

  // Instrument preferences
  const { setPreferences, getPreferences, clearPreferences } =
    useInstrumentPreferencesStore();

  // Current user info (mock - in real app this would come from user context)
  const currentUserId = useRef<string>("local-user");
  const currentUsername = useRef<string>("Local User");

  // Get preferences for current user
  const preferences = getPreferences(currentUserId.current);

  // Unified instrument manager
  const instrumentManager = useInstrumentManager();

  // Performance optimization hook (initialize but don't assign to variable to avoid unused warning)
  usePerformanceOptimization();

  // Local state
  const [isLoadingInstrument, setIsLoadingInstrument] =
    useState<boolean>(false);
  const [isAudioContextReady, setIsAudioContextReady] =
    useState<boolean>(false);
  const [audioContextError, setAudioContextError] = useState<string | null>(
    null,
  );
  const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(false);
  const [availableSamples, setAvailableSamples] = useState<string[]>([]);
  const [dynamicDrumMachines, setDynamicDrumMachines] = useState(DRUM_MACHINES);

  // Add a state trigger to force synthState updates
  const [synthStateUpdateTrigger, setSynthStateUpdateTrigger] =
    useState<number>(0);

  // Instrument fallback state
  const [lastFallbackInstrument, setLastFallbackInstrument] = useState<
    string | null
  >(null);
  const [lastFallbackCategory, setLastFallbackCategory] =
    useState<InstrumentCategory | null>(null);

  // Track loading state to prevent concurrent requests
  const isCurrentlyLoading = useRef<boolean>(false);

  // Initialize instrument values
  const getInitialInstrument = (): string => {
    if (initialInstrument) return initialInstrument;

    // Validate saved instrument before using it
    if (preferences.instrument) {
      const drumMachines = DRUM_MACHINES.map((dm) => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map((s) => s.value);
      const soundfonts = SOUNDFONT_INSTRUMENTS.map((s) => s.value);

      // Check if the saved instrument exists in any category
      if (
        drumMachines.includes(preferences.instrument) ||
        synthesizers.includes(preferences.instrument) ||
        soundfonts.includes(preferences.instrument)
      ) {
        return preferences.instrument;
      } else {
        // Clear invalid preferences
        clearPreferences();
      }
    }

    if (
      isSafari() &&
      (initialCategory || preferences.category) === InstrumentCategory.Melodic
    ) {
      return "bright_acoustic_piano"; // More Safari-compatible than acoustic_grand_piano
    }
    return "acoustic_grand_piano";
  };

  const getInitialCategory = (): InstrumentCategory => {
    if (initialCategory) return initialCategory;
    if (preferences.category) return preferences.category;

    // Auto-detect category based on saved instrument name
    if (preferences.instrument) {
      const drumMachines = DRUM_MACHINES.map((dm) => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map((s) => s.value);

      if (drumMachines.includes(preferences.instrument)) {
        return InstrumentCategory.DrumBeat;
      } else if (synthesizers.includes(preferences.instrument)) {
        return InstrumentCategory.Synthesizer;
      }
    }

    return InstrumentCategory.Melodic;
  };

  const [currentInstrument, setCurrentInstrument] = useState<string>(
    getInitialInstrument(),
  );
  const [currentCategory, setCurrentCategory] =
    useState<InstrumentCategory>(getInitialCategory());

  // Effect to refresh samples when local engine is ready (handles initial load for drum machines)
  useEffect(() => {
    if (
      currentCategory === InstrumentCategory.DrumBeat &&
      isAudioContextReady
    ) {
      // Check initial samples for drum machine

      const checkSamples = () => {
        const localEngine = instrumentManager.getLocalEngine();
        if (localEngine && localEngine.isReady()) {
          const actualSamples = instrumentManager.getLocalAvailableSamples();
          if (actualSamples.length > 0) {
            // Found samples for drum machine
            setAvailableSamples((prev) => {
              // Only update if samples actually changed to prevent infinite loops
              if (JSON.stringify(prev) !== JSON.stringify(actualSamples)) {
                return actualSamples;
              }
              return prev;
            });
            return true; // Found samples
          }
        }
        return false; // No samples yet
      };

      // Try immediately
      if (!checkSamples()) {
        // No samples found immediately, starting polling...
        // If no samples immediately, poll for them
        const pollInterval = setInterval(() => {
          if (checkSamples()) {
            clearInterval(pollInterval);
          }
        }, 100);

        // Clean up after 5 seconds to avoid infinite polling
        const timeout = setTimeout(() => {
          clearInterval(pollInterval);
          // Fallback to default samples if polling didn't find any
          const fallbackSamples = [
            "kick",
            "snare",
            "hihat",
            "openhat",
            "crash",
            "ride",
            "tom1",
            "tom2",
            "tom3",
            "clap",
            "perc1",
            "perc2",
          ];
          setAvailableSamples((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(fallbackSamples)) {
              return fallbackSamples;
            }
            return prev;
          });
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
  ]);

  // Synthesizer state tracking - now includes the update trigger as a dependency
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

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    try {
      setAudioContextError(null);
      setNeedsUserGesture(false);

      if (!instrumentManager.isReady()) {
        // Validate the category before initializing to ensure consistency
        const drumMachines = DRUM_MACHINES.map((dm) => dm.value);
        const synthesizers = SYNTHESIZER_INSTRUMENTS.map((s) => s.value);
        const soundfonts = SOUNDFONT_INSTRUMENTS.map((s) => s.value);

        let validatedCategory = currentCategory;
        let validatedInstrument = currentInstrument;

        if (drumMachines.includes(currentInstrument)) {
          validatedCategory = InstrumentCategory.DrumBeat;
        } else if (synthesizers.includes(currentInstrument)) {
          validatedCategory = InstrumentCategory.Synthesizer;
        } else if (soundfonts.includes(currentInstrument)) {
          validatedCategory = InstrumentCategory.Melodic;
        } else {
          // If instrument doesn't exist in any category, default to a safe option
          console.warn(
            `Unknown instrument: ${currentInstrument}, defaulting to acoustic_grand_piano`,
          );
          validatedInstrument = "acoustic_grand_piano";
          validatedCategory = InstrumentCategory.Melodic;
        }

        console.log(
          `Initializing audio with: ${validatedInstrument} (${validatedCategory})`,
        );

        // Update state if validation changed anything
        if (
          validatedCategory !== currentCategory ||
          validatedInstrument !== currentInstrument
        ) {
          setCurrentInstrument(validatedInstrument);
          setCurrentCategory(validatedCategory);
          setPreferences(
            currentUserId.current,
            validatedInstrument,
            validatedCategory,
          );
        }

        // This will initialize the audio context in the manager
        await instrumentManager.initializeLocalEngine({
          userId: currentUserId.current,
          username: currentUsername.current,
          instrumentName: validatedInstrument,
          category: validatedCategory,
          onSynthParamsChange,
          onInstrumentFallback: (
            originalInstrument: string,
            fallbackInstrument: string,
            category: InstrumentCategory,
          ) => {
            console.log(
              `🔄 Local instrument fallback: ${originalInstrument} → ${fallbackInstrument} (${category})`,
            );
            setLastFallbackInstrument(fallbackInstrument);
            setLastFallbackCategory(category);
            setCurrentInstrument(fallbackInstrument);
            setCurrentCategory(category);
            setPreferences(currentUserId.current, fallbackInstrument, category);
          },
        });
      }

      setIsAudioContextReady(true);
    } catch (error) {
      console.error("Failed to initialize audio context:", error);

      // Check if this is a user gesture error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isUserGestureError =
        errorMessage.includes("AudioContext state is closed") ||
        errorMessage.includes("user gesture") ||
        errorMessage.includes("suspended") ||
        errorMessage.includes("interact");

      if (isUserGestureError) {
        console.log(
          "🎵 AudioContext requires user gesture, showing enable button",
        );
        setNeedsUserGesture(true);
        setAudioContextError("Audio requires user interaction to initialize");
      } else {
        setAudioContextError(
          error instanceof Error
            ? error.message
            : "AudioContext initialization failed",
        );
      }
      throw error;
    }
  }, [
    instrumentManager,
    currentInstrument,
    currentCategory,
    onSynthParamsChange,
    setPreferences,
  ]);

  // Refresh available samples for drum machines
  const refreshAvailableSamples = useCallback(() => {
    if (currentCategory === InstrumentCategory.DrumBeat) {
      const localEngine = instrumentManager.getLocalEngine();
      if (localEngine && localEngine.isReady()) {
        const actualSamples = instrumentManager.getLocalAvailableSamples();
        if (actualSamples.length > 0) {
          setAvailableSamples(actualSamples);
        }
      }
    } else {
      setAvailableSamples([]);
    }
  }, [currentCategory, instrumentManager]);

  // Load instrument
  const loadInstrument = useCallback(
    async (instrumentName: string, category: InstrumentCategory) => {
      // Prevent concurrent loading requests
      if (isCurrentlyLoading.current) {
        console.log(
          `⏳ Already loading an instrument, skipping duplicate request for ${instrumentName}`,
        );
        return;
      }

      const drumMachines = DRUM_MACHINES.map((dm) => dm.value);
      const synthesizers = SYNTHESIZER_INSTRUMENTS.map((s) => s.value);
      const soundfonts = SOUNDFONT_INSTRUMENTS.map((s) => s.value);

      let validatedCategory = category;
      if (drumMachines.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.DrumBeat;
      } else if (synthesizers.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.Synthesizer;
      } else if (soundfonts.includes(instrumentName)) {
        validatedCategory = InstrumentCategory.Melodic;
      }

      isCurrentlyLoading.current = true;
      setIsLoadingInstrument(true);
      setAudioContextError(null);

      try {
        if (!instrumentManager.isReady()) {
          await instrumentManager.initializeLocalEngine({
            userId: currentUserId.current,
            username: currentUsername.current,
            instrumentName,
            category: validatedCategory,
            onSynthParamsChange,
            onInstrumentFallback: (
              originalInstrument: string,
              fallbackInstrument: string,
              category: InstrumentCategory,
            ) => {
              console.log(
                `🔄 Local instrument fallback: ${originalInstrument} → ${fallbackInstrument} (${category})`,
              );
              setLastFallbackInstrument(fallbackInstrument);
              setLastFallbackCategory(category);
              setCurrentInstrument(fallbackInstrument);
              setCurrentCategory(category);
              setPreferences(
                currentUserId.current,
                fallbackInstrument,
                category,
              );
            },
          });
        } else {
          await instrumentManager.updateLocalInstrument(
            instrumentName,
            validatedCategory,
          );
        }

        setCurrentInstrument(instrumentName);
        setCurrentCategory(validatedCategory);

        // Save preferences when instrument changes
        setPreferences(
          currentUserId.current,
          instrumentName,
          validatedCategory,
        );

        // Update available samples for drum machines
        if (validatedCategory === InstrumentCategory.DrumBeat) {
          const localEngine = instrumentManager.getLocalEngine();
          if (localEngine && localEngine.isReady()) {
            // Try to get samples immediately
            let actualSamples = instrumentManager.getLocalAvailableSamples();

            if (actualSamples.length === 0) {
              // If no samples available immediately, wait for them
              try {
                console.log("Waiting for drum machine samples to load...");
                actualSamples = await localEngine.waitForSamples(3000); // Wait up to 3 seconds
                console.log("Drum machine samples loaded:", actualSamples);
              } catch (error) {
                console.warn("Error waiting for drum machine samples:", error);
              }
            }

            if (actualSamples.length > 0) {
              setAvailableSamples(actualSamples);
            } else {
              // Fallback to default samples if still no samples available
              console.warn(
                "No samples available from drum machine, using fallback samples",
              );
              setAvailableSamples([
                "kick",
                "snare",
                "hihat",
                "openhat",
                "crash",
                "ride",
                "tom1",
                "tom2",
                "tom3",
                "clap",
                "perc1",
                "perc2",
              ]);
            }
          }
        } else {
          setAvailableSamples([]);
        }

        // For synthesizers, ensure parameters are synchronized after instrument change
        if (validatedCategory === InstrumentCategory.Synthesizer) {
          // Get the current synth state after instrument change
          const localEngine = instrumentManager.getLocalEngine();
          if (localEngine && localEngine.isReady()) {
            const currentSynthState = localEngine.getSynthState();
            if (currentSynthState && onSynthParamsChange) {
              // Synchronize all parameters to remote users
              console.log(
                "🎛️ Syncing synth parameters after instrument change:",
                currentSynthState,
              );
              setTimeout(() => {
                onSynthParamsChange(currentSynthState);
              }, 100);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to load instrument ${instrumentName}:`, error);
        setAudioContextError(
          error instanceof Error ? error.message : "Failed to load instrument",
        );
        throw error;
      } finally {
        isCurrentlyLoading.current = false;
        setIsLoadingInstrument(false);
      }
    },
    [instrumentManager, onSynthParamsChange, setPreferences],
  );

  // Handle instrument change
  const handleInstrumentChange = useCallback(
    async (instrumentName: string) => {
      await loadInstrument(instrumentName, currentCategory);
    },
    [loadInstrument, currentCategory],
  );

  // Handle category change
  const handleCategoryChange = useCallback(
    async (category: InstrumentCategory) => {
      // Get first instrument from the new category
      let firstInstrument: string;
      switch (category) {
        case InstrumentCategory.DrumBeat: {
          firstInstrument = dynamicDrumMachines[0]?.value || "TR-808";
          break;
        }
        case InstrumentCategory.Synthesizer: {
          firstInstrument = SYNTHESIZER_INSTRUMENTS[0]?.value || "analog_mono";
          break;
        }
        default: {
          firstInstrument =
            SOUNDFONT_INSTRUMENTS[0]?.value || "acoustic_grand_piano";
        }
      }

      await loadInstrument(firstInstrument, category);
    },
    [loadInstrument, dynamicDrumMachines],
  );

  // Get control type
  const getCurrentInstrumentControlType = useCallback((): ControlType => {
    switch (currentCategory) {
      case InstrumentCategory.DrumBeat:
        return ControlType.Drumpad;
      case InstrumentCategory.Synthesizer:
        return ControlType.Keyboard;
      default: {
        // For soundfont instruments, check the specific control type
        const instrument = SOUNDFONT_INSTRUMENTS.find(
          (inst) => inst.value === currentInstrument,
        );
        return instrument?.controlType || ControlType.Keyboard;
      }
    }
  }, [currentInstrument, currentCategory]);

  // Local playback methods
  const playNote = useCallback(
    async (notes: string[], velocity: number, isKeyHeld: boolean = false) => {
      try {
        if (!Array.isArray(notes)) {
          console.error(
            "useInstrument playNote received non-array notes:",
            notes,
          );
          notes = [notes as string];
        }
        if (!instrumentManager.isReady()) {
          await initializeAudioContext();
        }
        await instrumentManager.playLocalNotes(notes, velocity, isKeyHeld);
      } catch (error) {
        console.error("Failed to play local notes:", error);
      }
    },
    [instrumentManager, initializeAudioContext],
  );

  const stopNotes = useCallback(
    async (notes: string[]) => {
      try {
        if (!Array.isArray(notes)) {
          console.error(
            "useInstrument stopNotes received non-array notes:",
            notes,
          );
          notes = [notes as string];
        }
        await instrumentManager.stopLocalNotes(notes);
      } catch (error) {
        console.error("Failed to stop local notes:", error);
      }
    },
    [instrumentManager],
  );

  const releaseKeyHeldNote = useCallback(
    async (note: string) => {
      await stopNotes([note]);
    },
    [stopNotes],
  );

  const setSustainState = useCallback(
    (sustain: boolean) => {
      instrumentManager.setLocalSustain(sustain);
    },
    [instrumentManager],
  );

  const stopSustainedNotes = useCallback(() => {
    // This is handled internally by the engine when sustain is turned off
    setSustainState(false);
  }, [setSustainState]);

  // Synthesizer controls
  const updateSynthParams = useCallback(
    async (params: Partial<SynthState>) => {
      try {
        await instrumentManager.updateLocalSynthParams(params);
        setSynthStateUpdateTrigger((prev) => prev + 1); // Trigger update
      } catch (error) {
        console.error("Failed to update synth parameters:", error);
      }
    },
    [instrumentManager],
  );

  const loadPresetParams = useCallback(
    async (params: SynthState) => {
      await updateSynthParams(params);
    },
    [updateSynthParams],
  );

  // Remote user methods
  const playRemoteUserNote = useCallback(
    async (
      userId: string,
      username: string,
      notes: string[],
      velocity: number,
      instrumentName: string,
      category: InstrumentCategory,
      isKeyHeld: boolean = false,
    ) => {
      try {
        await instrumentManager.playRemoteNotes(
          userId,
          username,
          notes,
          velocity,
          instrumentName,
          category,
          isKeyHeld,
        );
      } catch (error) {
        console.error(
          `Failed to play remote notes for user ${username}:`,
          error,
        );
      }
    },
    [instrumentManager],
  );

  const stopRemoteUserNote = useCallback(
    async (
      userId: string,
      notes: string[],
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      try {
        await instrumentManager.stopRemoteNotes(
          userId,
          notes,
          instrumentName,
          category,
        );
      } catch (error) {
        console.error(`Failed to stop remote notes for user ${userId}:`, error);
      }
    },
    [instrumentManager],
  );

  const setRemoteUserSustain = useCallback(
    (
      userId: string,
      sustain: boolean,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      instrumentManager.setRemoteSustain(
        userId,
        sustain,
        instrumentName,
        category,
      );
    },
    [instrumentManager],
  );

  const updateRemoteUserInstrument = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
    ) => {
      try {
        console.log(
          `🎵 updateRemoteUserInstrument: Starting update for ${username} - ${instrumentName} (${category})`,
        );
        await instrumentManager.updateRemoteInstrument(
          userId,
          username,
          instrumentName,
          category,
        );
        console.log(
          `✅ updateRemoteUserInstrument: Successfully updated ${username} to ${instrumentName} (${category})`,
        );
      } catch (error) {
        console.error(
          `❌ updateRemoteUserInstrument: Failed to update remote instrument for user ${username}:`,
          error,
        );
        console.error(
          `❌ updateRemoteUserInstrument: Error details for ${username}:`,
          {
            userId,
            username,
            instrumentName,
            category,
            error,
          },
        );

        // For remote users, we don't automatically try fallbacks
        // The fallback will be handled by the remote user's own device
        // We just log the error and continue
      }
    },
    [instrumentManager],
  );

  const updateRemoteUserSynthParams = useCallback(
    async (
      userId: string,
      username: string,
      instrumentName: string,
      category: InstrumentCategory,
      params: Partial<SynthState>,
    ) => {
      try {
        await instrumentManager.updateRemoteSynthParams(
          userId,
          username,
          instrumentName,
          category,
          params,
        );
      } catch (error) {
        console.error(
          `Failed to update remote synth params for user ${username}:`,
          error,
        );
      }
    },
    [instrumentManager],
  );

  const cleanupRemoteUser = useCallback(
    (userId: string) => {
      instrumentManager.removeRemoteEngine(userId);
    },
    [instrumentManager],
  );

  const preloadRoomInstruments = useCallback(
    async (
      instruments: Array<{
        userId: string;
        username: string;
        instrumentName: string;
        category: string;
      }>,
    ) => {
      try {
        await instrumentManager.preloadInstruments(instruments);
      } catch (error) {
        console.error("Failed to preload room instruments:", error);
      }
    },
    [instrumentManager],
  );

  // Initialize on mount
  useEffect(() => {
    // Load cached drum machines
    const machines = getCachedDrumMachines();
    setDynamicDrumMachines(machines);
  }, []);

  // Auto-initialize audio context when component mounts
  useEffect(() => {
    const autoInit = async () => {
      // Only try to auto-initialize once, and not if we already know we need user gesture
      if (
        !isAudioContextReady &&
        !isCurrentlyLoading.current &&
        !needsUserGesture &&
        !audioContextError
      ) {
        console.log("🎵 Attempting auto-initialization of audio context");
        try {
          await initializeAudioContext();
        } catch {
          // Error is already handled in initializeAudioContext
          // Don't log again to avoid spam
        }
      }
    };

    autoInit();
  }, [
    initializeAudioContext,
    isAudioContextReady,
    needsUserGesture,
    audioContextError,
  ]);

  // WebRTC performance optimization effect
  useEffect(() => {
    const handleWebRTCState = (event: CustomEvent<{ active: boolean }>) => {
      const isWebRTCActive = event.detail.active;
      console.log(
        `🎵 Instrument Hook: WebRTC state changed: ${isWebRTCActive}`,
      );

      // Apply optimization to local engine
      const localEngine = instrumentManager.getLocalEngine();
      if (
        localEngine &&
        typeof localEngine.setWebRTCOptimization === "function"
      ) {
        localEngine.setWebRTCOptimization(isWebRTCActive);
      }
    };

    // Listen for WebRTC state changes
    window.addEventListener(
      "webrtc-active",
      handleWebRTCState as EventListener,
    );

    return () => {
      window.removeEventListener(
        "webrtc-active",
        handleWebRTCState as EventListener,
      );
    };
  }, [instrumentManager]);

  return {
    // Current instrument state
    currentInstrument,
    currentCategory,
    isLoadingInstrument,
    isAudioContextReady,
    audioContextError,
    needsUserGesture,
    availableSamples,
    dynamicDrumMachines,

    // Synthesizer state
    synthState,
    isSynthesizerLoaded,

    // Instrument fallback state
    lastFallbackInstrument,
    lastFallbackCategory,

    // Local instrument controls
    initializeAudioContext,
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,

    // Local playback methods
    playNote,
    stopNotes,
    stopSustainedNotes,
    releaseKeyHeldNote,
    setSustainState,

    // Synthesizer controls
    updateSynthParams,
    loadPresetParams,

    // Utility methods
    refreshAvailableSamples,

    // Remote instrument methods
    playRemoteUserNote,
    stopRemoteUserNote,
    setRemoteUserSustain,
    updateRemoteUserInstrument,
    updateRemoteUserSynthParams,
    cleanupRemoteUser,
    preloadRoomInstruments,

    // Instrument manager for room audio integration - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
    instrumentManager,
  };
};
