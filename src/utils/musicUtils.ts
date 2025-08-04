// Pure utility functions for music calculations

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const;

export type Scale = keyof typeof SCALES;

// Calculate note at specific fret position
export const getNoteAtFret = (
  openNote: string,
  fret: number
): string => {
  const openNoteName = openNote.replace(/\d/, "");
  const openNoteIndex = NOTE_NAMES.indexOf(openNoteName);
  const newNoteIndex = (openNoteIndex + fret) % 12;
  const octave = Math.floor((openNoteIndex + fret) / 12) + parseInt(openNote.replace(/\D/g, ""));
  
  return NOTE_NAMES[newNoteIndex] + octave;
};

// Generate scale notes for a given root, scale type, and octave
export const getScaleNotes = (
  root: string,
  scaleType: Scale,
  octave: number
): string[] => {
  const rootIndex = NOTE_NAMES.indexOf(root);
  return SCALES[scaleType].map((interval) => {
    const noteIndex = (rootIndex + interval) % 12;
    const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
    return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
  });
};

// Generate chord from scale degree
export const getChordFromDegree = (
  root: string,
  scaleType: Scale,
  degree: number,
  voicing: number = 0,
  modifiers: Set<string> = new Set()
): string[] => {
  const baseOctave = 3 + voicing;
  const scaleNotes = getScaleNotes(root, scaleType, baseOctave);
  
  const rootNoteOfChord = scaleNotes[degree % 7];
  const rootNoteIndex = getNoteIndex(rootNoteOfChord);
  
  const scaleNoteNames = getScaleNotes(root, scaleType, 0).map((n) => n.slice(0, -1));
  
  // Determine chord quality
  const rootNoteName = scaleNoteNames[degree % 7];
  const thirdNoteNameFromScale = scaleNoteNames[(degree + 2) % 7];
  const fifthNoteNameFromScale = scaleNoteNames[(degree + 4) % 7];
  
  const rootPitch = NOTE_NAMES.indexOf(rootNoteName);
  let thirdPitch = NOTE_NAMES.indexOf(thirdNoteNameFromScale);
  if (thirdPitch < rootPitch) thirdPitch += 12;
  let fifthPitch = NOTE_NAMES.indexOf(fifthNoteNameFromScale);
  if (fifthPitch < rootPitch) fifthPitch += 12;
  
  const thirdInterval = thirdPitch - rootPitch;
  const fifthInterval = fifthPitch - rootPitch;
  
  let quality: "major" | "minor" | "diminished" | "augmented" = "major";
  if (thirdInterval === 3 && fifthInterval === 7) {
    quality = "minor";
  } else if (thirdInterval === 3 && fifthInterval === 6) {
    quality = "diminished";
  } else if (thirdInterval === 4 && fifthInterval === 8) {
    quality = "augmented";
  }
  
  // Apply modifiers
  if (modifiers.has("majMinToggle")) {
    quality = quality === "major" ? "minor" : "major";
  }
  
  let chordIntervals: number[] = [];
  
  // Check for power chord modifier first
  if (modifiers.has("powerChordToggle")) {
    // Power chord: root and fifth only (no third) - ensure both notes are in same octave
    chordIntervals = [0, 7];
  } else if (modifiers.has("sus2")) {
    chordIntervals = [0, 2, 7];
  } else if (modifiers.has("sus4")) {
    chordIntervals = [0, 5, 7];
  } else {
    switch (quality) {
      case "major":
        chordIntervals = [0, 4, 7];
        break;
      case "minor":
        chordIntervals = [0, 3, 7];
        break;
      case "diminished":
        chordIntervals = [0, 3, 6];
        break;
      case "augmented":
        chordIntervals = [0, 4, 8];
        break;
    }
  }
  
  const chordNotes = chordIntervals.map((interval) =>
    getNoteFromIndex(rootNoteIndex + interval)
  );

  // Add seventh notes if modifiers are present
  let finalChordNotes = [...chordNotes];
  
  // Special handling for power chords - ensure only 2 notes in same octave
  if (modifiers.has("powerChordToggle")) {
    // For power chords, we want exactly 2 notes: root and fifth in the same octave
    const rootNote = chordNotes[0];
    const rootNoteIndex = getNoteIndex(rootNote);
    const fifthNoteIndex = rootNoteIndex + 7;
    const fifthNote = getNoteFromIndex(fifthNoteIndex);
    
    // Ensure both notes are in the same octave as the root
    const rootOctave = Math.floor(rootNoteIndex / 12);
    const fifthOctave = Math.floor(fifthNoteIndex / 12);
    
    let adjustedFifthNote = fifthNote;
    if (fifthOctave > rootOctave) {
      // Fifth is in higher octave, bring it down
      adjustedFifthNote = getNoteFromIndex(fifthNoteIndex - 12);
    }
    
    // Return power chord immediately - no additional notes or octave adjustments
    return [rootNote, adjustedFifthNote];
  }
  
  if (modifiers.has("dominant7")) {
    const rootNoteIndex = getNoteIndex(rootNoteOfChord);
    let seventhNoteIndex = rootNoteIndex + 10;
    const highestNoteIndex = getNoteIndex(finalChordNotes[finalChordNotes.length - 1]);
    if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
    finalChordNotes = [...finalChordNotes, getNoteFromIndex(seventhNoteIndex)];
  }
  
  if (modifiers.has("major7")) {
    const rootNoteIndex = getNoteIndex(rootNoteOfChord);
    let seventhNoteIndex = rootNoteIndex + 11;
    const highestNoteIndex = getNoteIndex(finalChordNotes[finalChordNotes.length - 1]);
    if (seventhNoteIndex <= highestNoteIndex) seventhNoteIndex += 12;
    finalChordNotes = [...finalChordNotes, getNoteFromIndex(seventhNoteIndex)];
  }

  return finalChordNotes.map((note) => {
    const noteIndex = getNoteIndex(note);
    const noteOctave = Math.floor(noteIndex / 12);
    if (noteOctave < baseOctave) {
      return getNoteFromIndex(noteIndex + 12);
    }
    if (noteOctave > baseOctave) {
      return getNoteFromIndex(noteIndex - 12);
    }
    return note;
  }).sort((a, b) => getNoteIndex(a) - getNoteIndex(b));
};

// Helper function to get note index
const getNoteIndex = (note: string): number => {
  if (!note) return 0;
  const noteName = note.slice(0, -1);
  const octave = parseInt(note.slice(-1));
  return NOTE_NAMES.indexOf(noteName) + octave * 12;
};

// Helper function to get note from index
const getNoteFromIndex = (index: number): string => {
  const noteName = NOTE_NAMES[index % 12];
  const octave = Math.floor(index / 12);
  return `${noteName}${octave}`;
};

// Generate chord name from scale degree
export const getChordName = (rootNote: string, scale: Scale, degree: number): string => {
  // Get the root note index
  const rootIndex = NOTE_NAMES.indexOf(rootNote);
  
  // Get the scale notes
  const scaleIntervals = SCALES[scale];
  const chordRootIndex = (rootIndex + scaleIntervals[degree % 7]) % 12;
  const chordRootName = NOTE_NAMES[chordRootIndex];
  
  // Define chord qualities for each degree in major and minor scales
  const MAJOR_CHORD_QUALITIES = ["", "m", "m", "", "", "m", "dim"];
  const MINOR_CHORD_QUALITIES = ["m", "dim", "", "m", "m", "", ""];
  
  const qualities = scale === "major" ? MAJOR_CHORD_QUALITIES : MINOR_CHORD_QUALITIES;
  const quality = qualities[degree % 7];
  
  return chordRootName + quality;
};

// Generate fret positions for fretboard
export const generateFretPositions = (
  strings: string[],
  openNotes: string[],
  frets: number,
  pressedFrets: Set<string>,
  scaleNotes?: string[]
) => {
  const positions = [];
  
  for (let stringIndex = 0; stringIndex < strings.length; stringIndex++) {
    for (let fret = 0; fret <= frets; fret++) {
      const note = getNoteAtFret(openNotes[stringIndex], fret);
      const fretKey = `${stringIndex}-${fret}`;
      
      positions.push({
        string: stringIndex,
        fret,
        note,
        isPressed: pressedFrets.has(fretKey),
        isScaleNote: scaleNotes ? scaleNotes.includes(note.slice(0, -1)) : false,
      });
    }
  }
  
  return positions;
};

// Generate virtual keys for keyboard
export const generateVirtualKeys = (
  mode: 'piano' | 'scale' | 'chord',
  rootNote: string,
  scale: Scale,
  octave: number,
  pressedKeys: Set<string>,
  keyMappings: string[]
) => {
  const keys: any[] = [];
  
  if (mode === 'piano') {
    // Generate piano keys
    const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
    const blackNotes = ["C#", "D#", "", "F#", "G#", "A#", ""];
    
    for (let i = 0; i < 2; i++) {
      whiteNotes.forEach((note, index) => {
        const noteOctave = octave + i;
        const keyIndex = i * 7 + index;
        const fullNote = `${note}${noteOctave}`;
        
        keys.push({
          id: `white-${keyIndex}`,
          note: fullNote,
          isBlack: false,
          position: keyIndex,
          keyboardShortcut: keyMappings[keyIndex],
          isPressed: pressedKeys.has(fullNote),
        });
      });
    }
    
    for (let i = 0; i < 2; i++) {
      blackNotes.forEach((note, index) => {
        if (note) {
          const noteOctave = octave + i;
          const position = i * 7 + index + 0.5;
          const fullNote = `${note}${noteOctave}`;
          
          keys.push({
            id: `black-${i}-${index}`,
            note: fullNote,
            isBlack: true,
            position,
            keyboardShortcut: keyMappings[index + 7],
            isPressed: pressedKeys.has(fullNote),
          });
        }
      });
    }
  } else if (mode === 'scale') {
    // Generate scale keys
    const scaleNotes = getScaleNotes(rootNote, scale, octave);
    const nextOctaveNotes = getScaleNotes(rootNote, scale, octave + 1);
    const allNotes = [...scaleNotes, ...nextOctaveNotes];
    
    allNotes.forEach((note, index) => {
      keys.push({
        id: `scale-${index}`,
        note,
        isBlack: false,
        position: index,
        keyboardShortcut: keyMappings[index],
        isPressed: pressedKeys.has(note),
        isScaleNote: true,
      });
    });
  }
  
  return keys;
};

// Generate drum pads configuration
export const generateDrumPads = (
  availableSamples: string[],
  maxPads: number,
  pressedPads: Set<string>,
  padAssignments: Record<string, string> = {}
) => {
  const colors = [
    "bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-orange-500",
    "bg-green-500", "bg-purple-500", "bg-indigo-500", "bg-pink-500",
    "bg-teal-500", "bg-cyan-500", "bg-lime-500", "bg-amber-500"
  ];
  
  const pads = [];
  
  for (let i = 0; i < Math.min(maxPads, availableSamples.length); i++) {
    const sample = availableSamples[i];
    const assignedSound = padAssignments[`pad-${i}`] || sample;
    
    // Create display label
    const label = sample.replace(/-/g, ' ').replace(/\d+/g, '').trim();
    const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
    
    pads.push({
      id: `pad-${i}`,
      label: displayLabel || sample,
      color: colors[i % colors.length],
      sound: assignedSound,
      isPressed: pressedPads.has(`pad-${i}`),
      keyboardShortcut: String.fromCharCode(97 + i), // a, b, c, etc.
    });
  }
  
  return pads;
}; 