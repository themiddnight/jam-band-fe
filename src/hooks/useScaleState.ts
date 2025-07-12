import { useState, useCallback } from "react";

export type Scale = "major" | "minor";

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

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
    []
  );

  return {
    scale,
    setScale,
    rootNote,
    setRootNote,
    getScaleNotes,
  };
};
