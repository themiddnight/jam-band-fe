export const melodySimpleKeys = [
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  ";",
  "'",
];
export const melodySimpleKeysUpper = [
  "q",
  "w",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
  "[",
  "]",
];
export const melodyAdvancedKeys = [
  "a",
  "w",
  "s",
  "e",
  "d",
  "f",
  "t",
  "g",
  "y",
  "h",
  "u",
  "j",
  "k",
  "o",
  "l",
  "p",
  ";",
  "'",
  "]",
];
export const chordTriadKeys = ["y", "u", "i", "o", "p", "[", "]"];
export const chordRootKeys = ["g", "h", "j", "k", "l", ";", "'"];

// Original mappings for scale-dependent modes (melody/chord)
export const whiteKeyMapping = [
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  ";",
  "'",
  "]",
];

export const blackKeyMapping = ["w", "e", "", "t", "y", "u", ""];

// New chromatic mappings for BasicKeyboard mode (always C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
// Full 2 octaves + next octave's C (25 keys total: 15 white + 10 black)
export const chromaticWhiteKeyMapping = [
  "a", // C (octave 1)
  "s", // D
  "d", // E
  "f", // F
  "g", // G
  "h", // A
  "j", // B
  "k", // C (octave 2)
  "l", // D
  ";", // E
  "'", // F
  "", // G (octave 2) - no shortcut
  "", // A (octave 2) - no shortcut
  "", // B (octave 2) - no shortcut
  "", // C (octave 3) - no shortcut
];

export const chromaticBlackKeyMapping = [
  "w", // C# (octave 1)
  "e", // D#
  "", // no key for E# (doesn't exist)
  "t", // F#
  "y", // G#
  "u", // A#
  "", // no key for B# (doesn't exist)
  "o", // C# (octave 2)
  "p", // D# (octave 2)
  "", // no key for E# (doesn't exist)
  "]", // F# (octave 2)
  "", // G# (octave 2) - no shortcut
  "", // A# (octave 2) - no shortcut
  "", // no key for B# (doesn't exist)
];
