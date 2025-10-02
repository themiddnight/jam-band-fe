/**
 * General MIDI Percussion Mapping (Channel 10)
 * Maps drum samples to standardized MIDI note numbers (35-81)
 * This allows consistent drum triggering across different drum machines
 * and enables MIDI device control of drum pads
 */

// General MIDI Percussion Note Numbers (MIDI notes 35-81, Channel 10)
export const GM_PERCUSSION_NOTES = {
  // Bass Drums (35-36)
  35: "C1",  // Acoustic Bass Drum
  36: "C#1", // Bass Drum 1 (Electronic)
  
  // Snares (38, 40)
  37: "D1",  // Side Stick/Rimshot
  38: "D#1", // Acoustic Snare
  39: "E1",  // Hand Clap
  40: "F1",  // Electric Snare
  
  // Toms (41, 43, 45, 47, 48, 50)
  41: "F#1", // Low Floor Tom
  43: "G1",  // High Floor Tom
  45: "A1",  // Low Tom
  47: "B1",  // Low-Mid Tom
  48: "C2",  // Hi-Mid Tom
  50: "D2",  // High Tom
  
  // Hi-Hats (42, 44, 46)
  42: "F#2", // Closed Hi-Hat
  44: "G#2", // Pedal Hi-Hat
  46: "A#2", // Open Hi-Hat
  
  // Cymbals (49, 51, 52, 53, 55, 57, 59)
  49: "C#2", // Crash Cymbal 1
  51: "D#2", // Ride Cymbal 1
  52: "E2",  // Chinese Cymbal
  53: "F2",  // Ride Bell
  55: "G2",  // Splash Cymbal
  57: "A2",  // Crash Cymbal 2
  59: "B2",  // Ride Cymbal 2
  
  // Percussion (54, 56, 58, 60-81)
  54: "F#2", // Tambourine
  56: "G#2", // Cowbell
  58: "A#2", // Vibraslap
  60: "C3",  // Hi Bongo
  61: "C#3", // Low Bongo
  62: "D3",  // Mute Hi Conga
  63: "D#3", // Open Hi Conga
  64: "E3",  // Low Conga
  65: "F3",  // High Timbale
  66: "F#3", // Low Timbale
  67: "G3",  // High Agogo
  68: "G#3", // Low Agogo
  69: "A3",  // Cabasa
  70: "A#3", // Maracas
  71: "B3",  // Short Whistle
  72: "C4",  // Long Whistle
  73: "C#4", // Short Guiro
  74: "D4",  // Long Guiro
  75: "D#4", // Claves
  76: "E4",  // Hi Wood Block
  77: "F4",  // Low Wood Block
  78: "F#4", // Mute Cuica
  79: "G4",  // Open Cuica
  80: "G#4", // Mute Triangle
  81: "A4",  // Open Triangle
} as const;

// Reverse mapping: Note name to MIDI number
export const GM_NOTE_TO_MIDI: Record<string, number> = Object.entries(GM_PERCUSSION_NOTES).reduce(
  (acc, [midiNum, noteName]) => {
    acc[noteName] = parseInt(midiNum);
    return acc;
  },
  {} as Record<string, number>,
);

// Standard 16-pad layout starting from C1 (Bass Drum)
// This matches the most common drum pad layouts (Akai MPD, etc.)
export const DEFAULT_PAD_NOTES = [
  "C1",  "C#1", "D1",  "D#1",  // Row 1: pad-0 to pad-3
  "E1",  "F1",  "F#1", "G1",   // Row 2: pad-4 to pad-7
  "G#1", "A1",  "A#1", "B1",   // Row 3: pad-8 to pad-11
  "C2",  "C#2", "D2",  "D#2",  // Row 4: pad-12 to pad-15
] as const;

// Sample name patterns to General MIDI note mapping
// Maps common drum sample naming conventions to appropriate MIDI notes
export const SAMPLE_TO_GM_NOTE_PATTERNS: Array<{
  patterns: string[];
  note: string;
  description: string;
}> = [
  // Bass Drums
  { patterns: ["kick", "bd", "bass_drum", "bassdrum"], note: "C1", description: "Bass Drum" },
  
  // Snares
  { patterns: ["snare", "sd", "snr"], note: "D#1", description: "Snare" },
  { patterns: ["rim", "rimshot", "side_stick"], note: "D1", description: "Rimshot" },
  { patterns: ["clap", "handclap"], note: "E1", description: "Hand Clap" },
  
  // Hi-Hats
  { patterns: ["hat_closed", "hh_closed", "hihat_closed", "chh"], note: "F#2", description: "Closed Hi-Hat" },
  { patterns: ["hat_open", "hh_open", "hihat_open", "ohh"], note: "A#2", description: "Open Hi-Hat" },
  { patterns: ["hat_pedal", "hh_pedal"], note: "G#2", description: "Pedal Hi-Hat" },
  
  // Toms
  { patterns: ["tom_low", "tom_floor", "low_tom", "ft", "tom1"], note: "F#1", description: "Low Tom" },
  { patterns: ["tom_mid", "tom_middle", "mid_tom", "mt", "tom2"], note: "G1", description: "Mid Tom" },
  { patterns: ["tom_high", "tom_hi", "high_tom", "ht", "tom3"], note: "A1", description: "High Tom" },
  
  // Cymbals
  { patterns: ["crash", "cr", "crash1"], note: "C#2", description: "Crash" },
  { patterns: ["ride", "rd", "ride1"], note: "D#2", description: "Ride" },
  { patterns: ["splash"], note: "G2", description: "Splash" },
  { patterns: ["china", "chinese"], note: "E2", description: "Chinese Cymbal" },
  
  // Percussion
  { patterns: ["cowbell", "cow"], note: "G#2", description: "Cowbell" },
  { patterns: ["tambourine", "tamb"], note: "F#2", description: "Tambourine" },
  { patterns: ["shaker", "shk"], note: "A#3", description: "Maracas/Shaker" },
  { patterns: ["conga_hi", "conga_high"], note: "D#3", description: "High Conga" },
  { patterns: ["conga_low", "conga_lo"], note: "E3", description: "Low Conga" },
  { patterns: ["bongo_hi", "bongo_high"], note: "C3", description: "High Bongo" },
  { patterns: ["bongo_lo", "bongo_low"], note: "C#3", description: "Low Bongo" },
  { patterns: ["claves"], note: "D#4", description: "Claves" },
  { patterns: ["wood", "woodblock"], note: "E4", description: "Wood Block" },
];

/**
 * Maps a drum sample name to a General MIDI note
 * @param sampleName - The name of the drum sample (e.g., "kick", "snare_acoustic")
 * @returns The corresponding General MIDI note (e.g., "C1", "D#1") or null if no match
 */
export function mapSampleToGMNote(sampleName: string): string | null {
  const lowerSample = sampleName.toLowerCase();
  
  for (const mapping of SAMPLE_TO_GM_NOTE_PATTERNS) {
    for (const pattern of mapping.patterns) {
      if (lowerSample.includes(pattern)) {
        return mapping.note;
      }
    }
  }
  
  return null;
}

/**
 * Maps an array of available samples to General MIDI notes
 * Returns a map of sample names to their GM notes
 * @param samples - Array of available drum sample names
 * @returns Map of sample name to GM note
 */
export function createSampleToNoteMap(samples: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedNotes = new Set<string>();
  
  // First pass: map samples with clear pattern matches
  samples.forEach((sample) => {
    const gmNote = mapSampleToGMNote(sample);
    if (gmNote && !usedNotes.has(gmNote)) {
      map.set(sample, gmNote);
      usedNotes.add(gmNote);
    }
  });
  
  // Second pass: assign remaining samples to unused GM notes
  const allGMNotes = Object.values(DEFAULT_PAD_NOTES);
  let noteIndex = 0;
  
  samples.forEach((sample) => {
    if (!map.has(sample) && noteIndex < allGMNotes.length) {
      // Find next unused note
      while (noteIndex < allGMNotes.length && usedNotes.has(allGMNotes[noteIndex])) {
        noteIndex++;
      }
      
      if (noteIndex < allGMNotes.length) {
        map.set(sample, allGMNotes[noteIndex]);
        usedNotes.add(allGMNotes[noteIndex]);
        noteIndex++;
      }
    }
  });
  
  return map;
}

/**
 * Get the pad layout for a specific page (16 pads per page)
 * @param pageNumber - 0-indexed page number
 * @returns Array of 16 note names for the pads
 */
export function getPadNotesForPage(pageNumber: number): string[] {
  // Each page has 16 pads, starting from different base notes
  // Page 0: C1-D#2 (most common drums)
  // Page 1: E2-F#3 (extended percussion)
  // Page 2: G3-A4 (additional percussion)
  
  const allGMNotes = Object.values(GM_PERCUSSION_NOTES);
  const startIndex = pageNumber * 16;
  const endIndex = Math.min(startIndex + 16, allGMNotes.length);
  
  const notes = allGMNotes.slice(startIndex, endIndex);
  
  // Fill remaining slots if less than 16
  while (notes.length < 16) {
    notes.push(notes[notes.length - 1] || "C1");
  }
  
  return notes;
}

/**
 * Get the page number for a given MIDI note
 * @param note - Note name (e.g., "C1", "D#1")
 * @returns Page number (0-indexed)
 */
export function getPageForNote(note: string): number {
  const allGMNotes = Object.values(GM_PERCUSSION_NOTES);
  const index = allGMNotes.indexOf(note as (typeof GM_PERCUSSION_NOTES)[keyof typeof GM_PERCUSSION_NOTES]);
  
  if (index === -1) return 0;
  return Math.floor(index / 16);
}
