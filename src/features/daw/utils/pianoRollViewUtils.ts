import type { Scale } from '@/shared/types';
import type { MidiNote } from '../types/daw';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const;

/**
 * Check if a MIDI note number is in the given scale
 */
export const isNoteInScale = (
  midiNumber: number,
  rootNote: string,
  scale: Scale
): boolean => {
  const noteInOctave = midiNumber % 12;
  const rootIndex = NOTE_NAMES.indexOf(rootNote);
  const scaleIntervals = SCALES[scale];
  
  // Check if the note's position relative to root matches any scale interval
  for (const interval of scaleIntervals) {
    if ((rootIndex + interval) % 12 === noteInOctave) {
      return true;
    }
  }
  
  return false;
};

/**
 * Get all MIDI numbers that should be visible based on view mode
 */
export const getVisibleMidiNumbers = (
  viewMode: 'all-keys' | 'scale-keys' | 'only-notes',
  rootNote: string,
  scale: Scale,
  notes: MidiNote[],
  lowestMidi: number = 0,
  highestMidi: number = 127
): number[] => {
  if (viewMode === 'all-keys') {
    // Show all chromatic keys
    const result: number[] = [];
    for (let midi = highestMidi; midi >= lowestMidi; midi--) {
      result.push(midi);
    }
    return result;
  }
  
  if (viewMode === 'only-notes') {
    // Show only rows that have notes
    const uniquePitches = new Set(notes.map(note => note.pitch));
    return Array.from(uniquePitches).sort((a, b) => b - a); // Descending order
  }
  
  if (viewMode === 'scale-keys') {
    // Show only keys in the scale, plus any notes that are out of scale
    const result: number[] = [];
    const notePitches = new Set(notes.map(note => note.pitch));
    
    for (let midi = highestMidi; midi >= lowestMidi; midi--) {
      const inScale = isNoteInScale(midi, rootNote, scale);
      const hasNote = notePitches.has(midi);
      
      if (inScale || hasNote) {
        result.push(midi);
      }
    }
    
    return result;
  }
  
  return [];
};

/**
 * Check if a note is out of scale (for coloring purposes)
 */
export const isNoteOutOfScale = (
  midiNumber: number,
  rootNote: string,
  scale: Scale
): boolean => {
  return !isNoteInScale(midiNumber, rootNote, scale);
};
