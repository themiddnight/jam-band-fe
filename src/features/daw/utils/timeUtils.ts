import type { TimeSignature } from '../types/daw';

const DEFAULT_PIXELS_PER_BEAT = 80;

export interface MusicalPosition {
  bars: number;
  beats: number;
  subdivisions: number;
}

export const beatsPerBar = (timeSignature: TimeSignature) =>
  (timeSignature.numerator * 4) / timeSignature.denominator;

export const beatsToMusicalPosition = (
  beats: number,
  timeSignature: TimeSignature
): MusicalPosition => {
  const beatsPerMeasure = beatsPerBar(timeSignature);
  const bars = Math.floor(beats / beatsPerMeasure);
  const remainder = beats % beatsPerMeasure;
  const beat = Math.floor(remainder);
  const subdivisions = Math.round((remainder - beat) * 4); // quarter subdivisions
  return {
    bars,
    beats: beat,
    subdivisions,
  };
};

export const musicalPositionToBeats = (
  position: MusicalPosition,
  timeSignature: TimeSignature
) => {
  const beatsPerMeasure = beatsPerBar(timeSignature);
  return (
    position.bars * beatsPerMeasure +
    position.beats +
    position.subdivisions / 4
  );
};

export const beatsToPixels = (
  beats: number,
  pixelsPerBeat = DEFAULT_PIXELS_PER_BEAT,
  zoom = 1
) => beats * pixelsPerBeat * zoom;

export const pixelsToBeats = (
  pixels: number,
  pixelsPerBeat = DEFAULT_PIXELS_PER_BEAT,
  zoom = 1
) => pixels / (pixelsPerBeat * zoom);

export const snapToGrid = (value: number, division: number) => {
  if (division <= 0) {
    return value;
  }
  const step = 1 / division;
  return Math.round(value / step) * step;
};

export const formatMusicalPosition = (
  beats: number,
  timeSignature: TimeSignature
) => {
  const { bars, beats: beat, subdivisions } = beatsToMusicalPosition(
    beats,
    timeSignature
  );
  return `${bars + 1}:${beat + 1}:${subdivisions + 1}`;
};

