// Drum preset configuration and assignments

export interface DrumPreset {
  id: string;
  name: string;
  description: string;
  drumMachine: string;
  padAssignments: Record<string, string>;
  padVolumes?: Record<string, number>; // Individual pad volume multipliers
}

// Helper function to create fallback assignments using available samples
// This will be populated dynamically when the drum machine loads
export const createFallbackAssignments = (
  availableSamples: string[],
): Record<string, string> => {
  const assignments: Record<string, string> = {};

  // Only assign if we have samples available
  if (availableSamples.length === 0) return assignments;

  // Assign samples to the first few pads to avoid empty assignments
  availableSamples.slice(0, 16).forEach((sample, index) => {
    assignments[`pad-${index}`] = sample;
  });

  return assignments;
};

// Smart sample mapping based on common drum machine sample naming patterns
export const createSmartAssignments = (
  availableSamples: string[],
): Record<string, string> => {
  const assignments: Record<string, string> = {};

  if (availableSamples.length === 0) return assignments;

  // Create a mapping function that tries to find the best match for each pad
  const findBestSample = (patterns: string[]): string | null => {
    for (const pattern of patterns) {
      const found = availableSamples.find((sample) =>
        sample.toLowerCase().includes(pattern.toLowerCase()),
      );
      if (found) {
        return found;
      }
    }
    return null;
  };

  // Define smart mappings for each pad position
  const padMappings = [
    // Group A (qwer asdf)
    { pad: "pad-0", patterns: ["kick", "bd", "bass", "boom", "drum", "1"] }, // Q - Bass Drum
    { pad: "pad-1", patterns: ["snare", "sd", "snap", "2"] }, // W - Snare Drum
    { pad: "pad-2", patterns: ["hihat", "hh", "hat", "closed", "ch", "3"] }, // E - Closed Hi-hat
    { pad: "pad-3", patterns: ["open", "oh", "crash", "cymbal", "ride", "4"] }, // R - Open Hi-hat/Crash
    { pad: "pad-4", patterns: ["low", "lt", "tom1", "floor", "tom", "5"] }, // A - Low Tom
    { pad: "pad-5", patterns: ["mid", "mt", "tom2", "rack", "tom", "6"] }, // S - Mid Tom
    { pad: "pad-6", patterns: ["high", "ht", "tom3", "hi", "tom", "7"] }, // D - High Tom
    { pad: "pad-7", patterns: ["clap", "cp", "hand", "snap", "8"] }, // F - Clap

    // Group B (uiop jkl;)
    { pad: "pad-8", patterns: ["crash", "cy", "cymbal", "splash", "9"] }, // U - Cymbal
    { pad: "pad-9", patterns: ["cowbell", "cb", "bell", "cow", "10"] }, // I - Cowbell
    { pad: "pad-10", patterns: ["maracas", "ma", "shake", "rattle", "11"] }, // O - Maracas
    { pad: "pad-11", patterns: ["rim", "rs", "stick", "side", "12"] }, // P - Rim Shot
    { pad: "pad-12", patterns: ["conga", "lc", "low_conga", "bongo", "13"] }, // J - Low Conga
    { pad: "pad-13", patterns: ["conga", "mc", "mid_conga", "bongo", "14"] }, // K - Mid Conga
    { pad: "pad-14", patterns: ["conga", "hc", "high_conga", "bongo", "15"] }, // L - High Conga
    { pad: "pad-15", patterns: ["claves", "cl", "wood", "block", "16"] }, // ; - Claves
  ];

  // Apply smart mapping
  padMappings.forEach(({ pad, patterns }) => {
    const sample = findBestSample(patterns);
    if (sample) {
      assignments[pad] = sample;
    }
  });

  // Fill remaining pads with any unused samples
  const usedSamples = new Set(Object.values(assignments));
  const unusedSamples = availableSamples.filter(
    (sample) => !usedSamples.has(sample),
  );

  // Find empty pads and fill them
  for (let i = 0; i < 16; i++) {
    const padId = `pad-${i}`;
    if (!assignments[padId] && unusedSamples.length > 0) {
      const sample = unusedSamples.shift()!;
      assignments[padId] = sample;
    }
  }

  // If we still have empty pads but no unused samples, just assign all samples in order
  if (Object.keys(assignments).length < 16 && availableSamples.length > 0) {
    for (let i = 0; i < 16; i++) {
      const padId = `pad-${i}`;
      if (!assignments[padId]) {
        const sampleIndex = i % availableSamples.length;
        assignments[padId] = availableSamples[sampleIndex];
      }
    }
  }
  return assignments;
};

// Updated default assignments using more generic/common sample names
// These are based on typical drum machine sample naming patterns
export const DEFAULT_DRUM_PRESETS: Record<string, DrumPreset[]> = {
  "TR-808": [
    {
      id: "tr808-default",
      name: "Default",
      description: "Default TR-808 layout with classic drum sounds",
      drumMachine: "TR-808",
      padAssignments: {
        // Group A (qwer asdf) - Main sounds
        "pad-0": "bd", // Q - Bass Drum
        "pad-1": "sd", // W - Snare Drum
        "pad-2": "ch", // E - Closed Hi-hat
        "pad-3": "oh", // R - Open Hi-hat
        "pad-4": "lt", // A - Low Tom
        "pad-5": "mt", // S - Mid Tom
        "pad-6": "ht", // D - High Tom
        "pad-7": "cp", // F - Clap
        // Group B (uiop jkl;) - Additional sounds
        "pad-8": "cy", // U - Cymbal
        "pad-9": "cb", // I - Cowbell
        "pad-10": "ma", // O - Maracas
        "pad-11": "rs", // P - Rim Shot
        "pad-12": "lc", // J - Low Conga
        "pad-13": "mc", // K - Mid Conga
        "pad-14": "hc", // L - High Conga
        "pad-15": "cl", // ; - Claves
      },
    },
  ],

  "LM-2": [
    {
      id: "lm2-default",
      name: "Default",
      description: "Default LinnDrum LM-2 layout",
      drumMachine: "LM-2",
      padAssignments: {
        "pad-0": "bd",
        "pad-1": "sd",
        "pad-2": "hh",
        "pad-3": "cr",
        "pad-4": "lt",
        "pad-5": "mt",
        "pad-6": "ht",
        "pad-7": "cp",
        "pad-8": "cy",
        "pad-9": "cb",
        "pad-10": "rs",
        "pad-11": "ta",
        "pad-12": "lc",
        "pad-13": "mc",
        "pad-14": "hc",
        "pad-15": "sh",
      },
    },
  ],

  "Casio-RZ1": [
    {
      id: "rz1-default",
      name: "Default",
      description: "Default Casio RZ-1 layout",
      drumMachine: "Casio-RZ1",
      padAssignments: {
        "pad-0": "bd",
        "pad-1": "sd",
        "pad-2": "ch",
        "pad-3": "oh",
        "pad-4": "lt",
        "pad-5": "mt",
        "pad-6": "ht",
        "pad-7": "cp",
        "pad-8": "cr",
        "pad-9": "cy",
        "pad-10": "cb",
        "pad-11": "rs",
        "pad-12": "lc",
        "pad-13": "mc",
        "pad-14": "hc",
        "pad-15": "sh",
      },
    },
  ],

  "MFB-512": [
    {
      id: "mfb512-default",
      name: "Default",
      description: "Default MFB-512 layout",
      drumMachine: "MFB-512",
      padAssignments: {
        "pad-0": "bd",
        "pad-1": "sd",
        "pad-2": "ch",
        "pad-3": "oh",
        "pad-4": "lt",
        "pad-5": "mt",
        "pad-6": "ht",
        "pad-7": "cp",
        "pad-8": "cr",
        "pad-9": "cy",
        "pad-10": "cb",
        "pad-11": "rs",
        "pad-12": "lc",
        "pad-13": "mc",
        "pad-14": "hc",
        "pad-15": "sh",
      },
    },
  ],

  "Roland CR-8000": [
    {
      id: "cr8000-default",
      name: "Default",
      description: "Default Roland CR-8000 layout",
      drumMachine: "Roland CR-8000",
      padAssignments: {
        "pad-0": "bd",
        "pad-1": "sd",
        "pad-2": "ch",
        "pad-3": "oh",
        "pad-4": "lt",
        "pad-5": "mt",
        "pad-6": "ht",
        "pad-7": "cp",
        "pad-8": "cr",
        "pad-9": "cy",
        "pad-10": "cb",
        "pad-11": "rs",
        "pad-12": "lc",
        "pad-13": "mc",
        "pad-14": "hc",
        "pad-15": "sh",
      },
    },
  ],
};

// Helper function to get presets for a specific drum machine
export const getPresetsForDrumMachine = (drumMachine: string): DrumPreset[] => {
  return DEFAULT_DRUM_PRESETS[drumMachine] || [];
};

// Helper function to get default preset for a drum machine
export const getDefaultPreset = (drumMachine: string): DrumPreset | null => {
  const presets = getPresetsForDrumMachine(drumMachine);
  return presets.length > 0 ? presets[0] : null;
};

// Helper function to validate and fix preset assignments against available samples
export const validatePresetAssignments = (
  preset: DrumPreset,
  availableSamples: string[],
): DrumPreset => {
  const validatedAssignments: Record<string, string> = {};

  Object.entries(preset.padAssignments).forEach(([padId, sampleName]) => {
    // Check if the sample exists in available samples
    if (availableSamples.includes(sampleName)) {
      validatedAssignments[padId] = sampleName;
    } else {
      // Try to find a similar sample name
      const similarSample = availableSamples.find(
        (sample) =>
          sample.toLowerCase().includes(sampleName.toLowerCase()) ||
          sampleName.toLowerCase().includes(sample.toLowerCase()),
      );

      if (similarSample) {
        validatedAssignments[padId] = similarSample;
      }
      // If no similar sample found, don't assign anything to this pad yet
    }
  });

  // If we have many unassigned pads, use smart assignments to fill them
  const unassignedPads = [];
  for (let i = 0; i < 16; i++) {
    const padId = `pad-${i}`;
    if (!validatedAssignments[padId]) {
      unassignedPads.push(padId);
    }
  }

  // If more than half the pads are unassigned, use smart assignments for ALL pads
  if (unassignedPads.length > 8) {
    const smartAssignments = createSmartAssignments(availableSamples);
    return {
      ...preset,
      padAssignments: smartAssignments,
    };
  }

  // Otherwise, just fill the unassigned pads with remaining samples
  const usedSamples = new Set(Object.values(validatedAssignments));
  const unusedSamples = availableSamples.filter(
    (sample) => !usedSamples.has(sample),
  );

  unassignedPads.forEach((padId, index) => {
    if (index < unusedSamples.length) {
      validatedAssignments[padId] = unusedSamples[index];
    }
  });

  return {
    ...preset,
    padAssignments: validatedAssignments,
  };
};

// Fixed keyboard shortcuts for the 16 pads
export const DRUMPAD_SHORTCUTS = {
  // Group A: qwer asdf (8 pads)
  "pad-0": "q",
  "pad-1": "w",
  "pad-2": "e",
  "pad-3": "r",
  "pad-4": "a",
  "pad-5": "s",
  "pad-6": "d",
  "pad-7": "f",
  // Group B: uiop jkl; (8 pads)
  "pad-8": "u",
  "pad-9": "i",
  "pad-10": "o",
  "pad-11": "p",
  "pad-12": "j",
  "pad-13": "k",
  "pad-14": "l",
  "pad-15": ";",
} as const;

// Fixed colors for consistent appearance
export const DRUMPAD_COLORS = [
  // Group A colors (warmer tones)
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-red-400",
  "bg-orange-400",
  // Group B colors (cooler tones)
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-blue-400",
  "bg-indigo-400",
] as const;
