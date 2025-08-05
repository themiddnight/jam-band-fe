import { useCallback } from "react";

export const useGuitarBasicMode = (
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onReleaseKeyHeldNote: (note: string) => void,
  velocity: number,
) => {
  // Handle fret press/release for basic mode
  const handleBasicFretPress = useCallback(async () => {
    // This is now handled by useUnifiedInstrumentState
  }, []);

  const handleBasicFretRelease = useCallback(() => {
    // This is now handled by useUnifiedInstrumentState
  }, []);

  const handleBasicPlayNote = useCallback(
    async (note: string, customVelocity?: number) => {
      const noteVelocity =
        customVelocity !== undefined ? customVelocity : velocity;
      await onPlayNotes([note], noteVelocity, true);
    },
    [onPlayNotes, velocity],
  );

  const handleBasicReleaseNote = useCallback(
    (note: string) => {
      onReleaseKeyHeldNote(note);
    },
    [onReleaseKeyHeldNote],
  );

  return {
    handleBasicFretPress,
    handleBasicFretRelease,
    handleBasicPlayNote,
    handleBasicReleaseNote,
  };
};
