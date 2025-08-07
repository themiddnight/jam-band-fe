import { useCallback, useRef } from "react";

export const useGuitarBasicMode = (
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void,
  onReleaseKeyHeldNote: (note: string) => void,
  velocity: number,
) => {
  // Track pressed frets in the format "stringIndex-fret"
  const pressedFrets = useRef<Set<string>>(new Set());

  // Handle fret press for basic mode
  const handleBasicFretPress = useCallback(
    async (stringIndex: number, fret: number) => {
      const fretKey = `${stringIndex}-${fret}`;
      pressedFrets.current.add(fretKey);
    },
    [],
  );

  const handleBasicFretRelease = useCallback(
    (stringIndex: number, fret: number) => {
      const fretKey = `${stringIndex}-${fret}`;
      pressedFrets.current.delete(fretKey);
    },
    [],
  );

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
