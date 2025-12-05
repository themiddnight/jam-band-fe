import { useCallback } from "react";
import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
  InstrumentCategory,
} from "@/shared/constants/instruments";
import { ControlType } from "@/shared/types";
import type { SynthState } from "@/features/instruments";

interface UseInstrumentPlaybackProps {
  instrumentManager: any;
  state: any;
  audio: any;
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
}

export const useInstrumentPlayback = ({
  instrumentManager,
  state,
  audio,
  onSynthParamsChange,
}: UseInstrumentPlaybackProps) => {
  const {
    currentInstrument,
    setCurrentInstrument,
    currentCategory,
    setCurrentCategory,
    setPreferences,
    preferences,
    currentUserId,
    currentUsername,
    setIsLoadingInstrument,
    isCurrentlyLoading,
    setAudioContextError,
    setAvailableSamples,
    dynamicDrumMachines,
    setSynthStateUpdateTrigger,
    setLastFallbackInstrument,
    setLastFallbackCategory,
  } = state;

  const { initializeAudioContext } = audio;

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
  }, [currentCategory, instrumentManager, setAvailableSamples]);

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
        // Stop all currently playing notes before switching instruments
        if (instrumentManager.isReady()) {
          await instrumentManager.stopAllLocalNotes();
        }

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
                preferences.synthParams,
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

        // Get fresh preferences to preserve synth params if they exist
        // Note: We use the ref's current value for userId
        // But we can't call getPreferences directly inside here if it's not passed fresh
        // However, we have 'preferences' from props which might be stale if not updated?
        // state.preferences is from useInstrumentState which calls getPreferences()
        // It should be fine as long as the component re-renders on pref change.
        // But here we might want to use the setter logic directly.
        
        // Save preferences when instrument changes
        setPreferences(
          currentUserId.current,
          instrumentName,
          validatedCategory,
          preferences?.synthParams,
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
                actualSamples = await localEngine.waitForSamples(3000); // Wait up to 3 seconds
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
          // Check if we have saved params to restore
          if (
            preferences &&
            preferences.synthParams &&
            Object.keys(preferences.synthParams).length > 0
          ) {
            console.log(
              "🎛️ Restoring saved synth params:",
              preferences.synthParams,
            );
            try {
              await instrumentManager.updateLocalSynthParams(
                preferences.synthParams,
              );
            } catch (error) {
              console.error("Failed to restore synth params:", error);
            }
          }

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
    [
      instrumentManager,
      onSynthParamsChange,
      setPreferences,
      currentUserId,
      currentUsername,
      preferences,
      isCurrentlyLoading,
      setIsLoadingInstrument,
      setAudioContextError,
      setLastFallbackInstrument,
      setLastFallbackCategory,
      setCurrentInstrument,
      setCurrentCategory,
      setAvailableSamples,
    ],
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
        setSynthStateUpdateTrigger((prev: number) => prev + 1); // Trigger update

        // Save synth params to preferences
        // Merge with existing params
        const newSynthParams = {
          ...(preferences.synthParams || {}),
          ...params,
        };

        setPreferences(
          currentUserId.current,
          currentInstrument,
          currentCategory,
          newSynthParams,
        );
      } catch (error) {
        console.error("Failed to update synth parameters:", error);
      }
    },
    [
      instrumentManager,
      currentInstrument,
      currentCategory,
      setPreferences,
      setSynthStateUpdateTrigger,
      preferences,
      currentUserId,
    ],
  );

  const loadPresetParams = useCallback(
    async (params: SynthState) => {
      await updateSynthParams(params);
    },
    [updateSynthParams],
  );

  return {
    loadInstrument,
    handleInstrumentChange,
    handleCategoryChange,
    getCurrentInstrumentControlType,
    playNote,
    stopNotes,
    releaseKeyHeldNote,
    setSustainState,
    stopSustainedNotes,
    updateSynthParams,
    loadPresetParams,
    refreshAvailableSamples,
  };
};
