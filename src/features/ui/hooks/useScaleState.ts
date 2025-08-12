import type { Scale } from "../../../shared/types";
import { NOTE_NAMES, SCALES } from "../utils/musicUtils";
import { useState, useCallback } from "react";

export const useScaleState = () => {
  const [scale, setScale] = useState<Scale>("major");
  const [rootNote, setRootNote] = useState<string>("C");

  const getScaleNotes = useCallback(
    (root: string, scaleType: Scale, octave: number) => {
      const rootIndex = NOTE_NAMES.indexOf(root);
      return SCALES[scaleType].map((interval) => {
        const noteIndex = (rootIndex + interval) % 12;
        const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
        return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
      });
    },
    [],
  );

  return {
    scale,
    setScale,
    rootNote,
    setRootNote,
    getScaleNotes,
  };
};
