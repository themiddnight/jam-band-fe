/**
 * Transpose utility functions for note manipulation
 * Used for shift+key = +1 semitone feature and future project-wide transpose
 */

// Standard note order for chromatic scale
const NOTE_ORDER = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

type NoteName = (typeof NOTE_ORDER)[number];

/**
 * Parse a note string into its components
 * @param note - Note string like "C4", "C#3", "D#5"
 * @returns Object with noteName and octave, or null if invalid
 */
export function parseNote(note: string): { noteName: NoteName; octave: number } | null {
  // Match note name (with optional #) and octave number
  const match = note.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;

  const noteName = match[1] as NoteName;
  const octave = parseInt(match[2], 10);

  if (!NOTE_ORDER.includes(noteName)) return null;

  return { noteName, octave };
}

/**
 * Convert note components back to string
 * @param noteName - Note name like "C", "C#"
 * @param octave - Octave number
 * @returns Note string like "C4"
 */
export function formatNote(noteName: NoteName, octave: number): string {
  return `${noteName}${octave}`;
}

/**
 * Get the chromatic index of a note (0-11)
 * @param noteName - Note name like "C", "C#"
 * @returns Index in chromatic scale (0-11)
 */
export function getNoteIndex(noteName: NoteName): number {
  return NOTE_ORDER.indexOf(noteName);
}

/**
 * Get note name from chromatic index
 * @param index - Index in chromatic scale (0-11)
 * @returns Note name
 */
export function getNoteFromIndex(index: number): NoteName {
  // Handle negative indices and wrap around
  const normalizedIndex = ((index % 12) + 12) % 12;
  return NOTE_ORDER[normalizedIndex];
}

/**
 * Transpose a single note by a number of semitones
 * @param note - Note string like "C4", "C#3"
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns Transposed note string, or original if invalid
 */
export function transposeNote(note: string, semitones: number): string {
  const parsed = parseNote(note);
  if (!parsed) return note;

  const { noteName, octave } = parsed;
  const currentIndex = getNoteIndex(noteName);
  
  // Calculate new index and octave change
  const totalSemitones = currentIndex + semitones;
  const newIndex = ((totalSemitones % 12) + 12) % 12;
  const octaveChange = Math.floor(totalSemitones / 12);
  
  const newNoteName = NOTE_ORDER[newIndex];
  const newOctave = octave + octaveChange;

  return formatNote(newNoteName, newOctave);
}

/**
 * Transpose an array of notes by a number of semitones
 * @param notes - Array of note strings
 * @param semitones - Number of semitones to transpose
 * @returns Array of transposed note strings
 */
export function transposeNotes(notes: string[], semitones: number): string[] {
  return notes.map((note) => transposeNote(note, semitones));
}

/**
 * Sharp modifier: transpose note up by 1 semitone
 * Convenience function for shift+key feature
 * @param note - Note string
 * @returns Note transposed up by 1 semitone
 */
export function sharpNote(note: string): string {
  return transposeNote(note, 1);
}

/**
 * Flat modifier: transpose note down by 1 semitone
 * @param note - Note string
 * @returns Note transposed down by 1 semitone
 */
export function flatNote(note: string): string {
  return transposeNote(note, -1);
}

/**
 * Sharp modifier for array of notes
 * @param notes - Array of note strings
 * @returns Array of notes transposed up by 1 semitone
 */
export function sharpNotes(notes: string[]): string[] {
  return transposeNotes(notes, 1);
}

/**
 * Flat modifier for array of notes
 * @param notes - Array of note strings
 * @returns Array of notes transposed down by 1 semitone
 */
export function flatNotes(notes: string[]): string[] {
  return transposeNotes(notes, -1);
}

// Export NOTE_ORDER for use in other modules
export { NOTE_ORDER };
