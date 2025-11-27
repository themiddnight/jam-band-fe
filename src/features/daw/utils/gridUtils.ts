/**
 * Calculate appropriate grid division based on zoom level
 * Returns the grid division as a fraction (e.g., 4 = quarter notes, 8 = eighth notes)
 * For extreme zoom out, returns fractional values to show every N bars
 */
export const getGridDivisionForZoom = (zoom: number): number => {
  // At extreme zoom (>= 16x), show 64th notes
  if (zoom >= 16) {
    return 64;
  }
  // At very high zoom (>= 8x), show 32nd notes
  if (zoom >= 8) {
    return 64;
  }
  // At high zoom (>= 4x), show 16th notes
  if (zoom >= 4) {
    return 32;
  }
  // At medium zoom (>= 2x), show 8th notes
  if (zoom >= 2) {
    return 16;
  }
  // At normal zoom (>= 1x), show quarter notes
  if (zoom >= 1) {
    return 8;
  }
  // At low zoom (>= 0.5x), show half notes
  if (zoom >= 0.5) {
    return 4;
  }
  // At very low zoom (>= 0.2x), show whole notes (1 bar)
  if (zoom >= 0.2) {
    return 1;
  }
  // At extremely low zoom (>= 0.1x), show every 4 bars
  if (zoom >= 0.1) {
    return 0.25; // 4/0.25 = 16 beats = 4 bars
  }
  // At ultra low zoom (>= 0.05x), show every 8 bars  
  if (zoom >= 0.05) {
    return 0.125; // 4/0.125 = 32 beats = 8 bars
  }
  // At minimum zoom, show every 16 bars
  return 0.0625; // 4/0.0625 = 64 beats = 16 bars
};

/**
 * Get the beat interval for grid lines based on division
 * Returns how often to draw lines (in beats)
 */
export const getGridInterval = (gridDivision: number): number => {
  return 4 / gridDivision; // 4 beats per bar / division
};

/**
 * Check if a beat position is on a major grid line (bar line)
 */
export const isBarLine = (beat: number, beatsPerBar: number): boolean => {
  return beat % beatsPerBar === 0;
};

/**
 * Check if a beat position is on a beat line (quarter note)
 */
export const isBeatLine = (beat: number): boolean => {
  const quarterNoteInterval = 1; // Quarter note = 1 beat
  return Math.abs(beat % quarterNoteInterval) < 0.001;
};

/**
 * Get grid line color and weight based on position
 */
export const getGridLineStyle = (
  beat: number,
  beatsPerBar: number
): { color: string; weight: number; opacity: number } => {
  // Bar lines (strongest)
  if (isBarLine(beat, beatsPerBar)) {
    return { color: '#888888', weight: 1, opacity: 0.5 };
  }
  
  // Beat lines (quarter notes - medium)
  if (isBeatLine(beat)) {
    return { color: '#888888', weight: 1, opacity: 0.3 };
  }
  
  // Sub-beat lines (weakest)
  return { color: '#888888', weight: 1, opacity: 0.15 };
};

