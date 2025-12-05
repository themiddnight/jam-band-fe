import { useCallback } from "react";
import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
  InstrumentCategory,
} from "@/shared/constants/instruments";
import type { SynthState } from "@/features/instruments";

interface UseInstrumentAudioProps {
  instrumentManager: any;
  currentInstrument: string;
  currentCategory: InstrumentCategory;
  currentUserId: React.MutableRefObject<string>;
  currentUsername: React.MutableRefObject<string>;
  preferences: any;
  setPreferences: any;
  setCurrentInstrument: (name: string) => void;
  setCurrentCategory: (category: InstrumentCategory) => void;
  setNeedsUserGesture: (needs: boolean) => void;
  setAudioContextError: (error: string | null) => void;
  setIsAudioContextReady: (isReady: boolean) => void;
  setLastFallbackInstrument: (name: string) => void;
  setLastFallbackCategory: (category: InstrumentCategory) => void;
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
}

export const useInstrumentAudio = ({
  instrumentManager,
  currentInstrument,
  currentCategory,
  currentUserId,
  currentUsername,
  preferences,
  setPreferences,
  setCurrentInstrument,
  setCurrentCategory,
  setNeedsUserGesture,
  setAudioContextError,
  setIsAudioContextReady,
  setLastFallbackInstrument,
  setLastFallbackCategory,
  onSynthParamsChange,
}: UseInstrumentAudioProps) => {
  
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
            preferences.synthParams,
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
            setPreferences(currentUserId.current, fallbackInstrument, category, preferences.synthParams);
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
    currentUserId,
    currentUsername,
    preferences.synthParams,
    setCurrentInstrument,
    setCurrentCategory,
    setNeedsUserGesture,
    setAudioContextError,
    setIsAudioContextReady,
    setLastFallbackInstrument,
    setLastFallbackCategory,
  ]);

  return {
    initializeAudioContext,
  };
};
