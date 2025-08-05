// Chord modifier configuration for UI components
export enum ChordModifierType {
  DOMINANT_7 = "dominant7",
  MAJOR_7 = "major7",
  SUS2 = "sus2",
  SUS4 = "sus4",
  MAJ_MIN_TOGGLE = "majMinToggle",
  POWER_CHORD = "powerChord",
}

// Display names for chord modifiers
export const CHORD_MODIFIER_DISPLAY_NAMES: Record<ChordModifierType, string> = {
  [ChordModifierType.DOMINANT_7]: "dom7",
  [ChordModifierType.MAJOR_7]: "maj7",
  [ChordModifierType.SUS2]: "sus2",
  [ChordModifierType.SUS4]: "sus4",
  [ChordModifierType.MAJ_MIN_TOGGLE]: "maj/min",
  [ChordModifierType.POWER_CHORD]: "Power",
};

// Color classes for chord modifier buttons
export const CHORD_MODIFIER_COLORS: Record<ChordModifierType, string> = {
  [ChordModifierType.DOMINANT_7]: "bg-yellow-500 text-black",
  [ChordModifierType.MAJOR_7]: "bg-yellow-500 text-black",
  [ChordModifierType.SUS2]: "bg-green-500 text-black",
  [ChordModifierType.SUS4]: "bg-green-500 text-black",
  [ChordModifierType.MAJ_MIN_TOGGLE]: "bg-blue-500 text-black",
  [ChordModifierType.POWER_CHORD]: "bg-purple-500 text-black",
};

// Default inactive color
export const CHORD_MODIFIER_INACTIVE_COLOR = "bg-gray-600 text-gray-300";

// Helper function to get chord modifier display name
export const getChordModifierDisplayName = (
  modifier: ChordModifierType,
): string => {
  return CHORD_MODIFIER_DISPLAY_NAMES[modifier];
};

// Helper function to get chord modifier color class
export const getChordModifierColorClass = (
  modifier: ChordModifierType,
  isActive: boolean,
): string => {
  return isActive
    ? CHORD_MODIFIER_COLORS[modifier]
    : CHORD_MODIFIER_INACTIVE_COLOR;
};

// Helper function to convert string to ChordModifierType
export const stringToChordModifier = (
  str: string,
): ChordModifierType | null => {
  const modifier = Object.values(ChordModifierType).find((m) => m === str);
  return modifier || null;
};

// Helper function to check if a string is a valid chord modifier
export const isValidChordModifier = (str: string): boolean => {
  return Object.values(ChordModifierType).includes(str as ChordModifierType);
};
