import { useState, useRef, useEffect } from "react";
import { useUserStore } from "@/shared/stores";
import { useInstrumentPreferencesStore } from "@/features/audio";
import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
  InstrumentCategory,
} from "@/shared/constants/instruments";
import { isSafari } from "@/shared/utils/webkitCompat";
import { getCachedDrumMachines } from "@/features/instruments";

export interface UseInstrumentStateOptions {
  initialInstrument?: string;
  initialCategory?: InstrumentCategory;
}

export const useInstrumentState = (options: UseInstrumentStateOptions = {}) => {
  const { initialInstrument, initialCategory } = options;

  // User info
  const { userId: storeUserId, username: storeUsername } = useUserStore();
  const currentUserId = useRef<string>(storeUserId || "local-user");
  const currentUsername = useRef<string>(storeUsername || "Local User");

  // Preferences
  const { setPreferences, getPreferences, clearPreferences } =
    useInstrumentPreferencesStore();
  const preferences = getPreferences(currentUserId.current);

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

    const targetCategory = initialCategory || preferences.category || InstrumentCategory.Melodic;

    if (
      isSafari() &&
      targetCategory === InstrumentCategory.Melodic
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

  // State definitions
  const [currentInstrument, setCurrentInstrument] = useState<string>(
    getInitialInstrument(),
  );
  const [currentCategory, setCurrentCategory] = useState<InstrumentCategory>(
    getInitialCategory(),
  );

  // Start with loading=true on Safari/WebKit to ensure UI shows loading until instrument is ready
  const [isLoadingInstrument, setIsLoadingInstrument] = useState<boolean>(() =>
    isSafari(),
  );
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
  // Ensure we auto-load the first instrument once audio context is usable
  const hasAutoLoadedInitialInstrument = useRef<boolean>(false);

  // Initialize on mount
  useEffect(() => {
    const machines = getCachedDrumMachines();
    setDynamicDrumMachines(machines);
  }, []);

  return {
    // User Refs
    currentUserId,
    currentUsername,

    // Preferences
    preferences,
    setPreferences,
    getPreferences,
    clearPreferences,

    // States & Setters
    currentInstrument,
    setCurrentInstrument,
    currentCategory,
    setCurrentCategory,

    isLoadingInstrument,
    setIsLoadingInstrument,
    isAudioContextReady,
    setIsAudioContextReady,
    audioContextError,
    setAudioContextError,
    needsUserGesture,
    setNeedsUserGesture,
    availableSamples,
    setAvailableSamples,
    dynamicDrumMachines,
    setDynamicDrumMachines,
    synthStateUpdateTrigger,
    setSynthStateUpdateTrigger,

    lastFallbackInstrument,
    setLastFallbackInstrument,
    lastFallbackCategory,
    setLastFallbackCategory,

    isCurrentlyLoading,
    hasAutoLoadedInitialInstrument,
  };
};
