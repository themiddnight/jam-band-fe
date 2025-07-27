export interface KeyboardShortcut {
  key: string;
  description: string;
  category: 'mode' | 'chord' | 'control' | 'octave' | 'velocity';
}

export interface KeyboardShortcuts {
  // Mode controls
  toggleMelodyChord: KeyboardShortcut;
  
  // Chord modifiers
  dominant7: KeyboardShortcut;
  major7: KeyboardShortcut;
  sus2: KeyboardShortcut;
  sus4: KeyboardShortcut;
  majMinToggle: KeyboardShortcut;
  
  // Control keys
  sustain: KeyboardShortcut;
  sustainToggle: KeyboardShortcut;
  
  // Octave controls
  octaveDown: KeyboardShortcut;
  octaveUp: KeyboardShortcut;
  
  // Voicing controls
  voicingDown: KeyboardShortcut;
  voicingUp: KeyboardShortcut;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  toggleMelodyChord: {
    key: 'shift',
    description: 'Toggle between melody and chord modes',
    category: 'mode'
  },
  
  dominant7: {
    key: 'q',
    description: 'Add dominant 7th to chord',
    category: 'chord'
  },
  
  major7: {
    key: 'w',
    description: 'Add major 7th to chord',
    category: 'chord'
  },
  
  sus2: {
    key: 'a',
    description: 'Convert chord to sus2',
    category: 'chord'
  },
  
  sus4: {
    key: 's',
    description: 'Convert chord to sus4',
    category: 'chord'
  },
  
  majMinToggle: {
    key: 'd',
    description: 'Toggle between major and minor chord quality',
    category: 'chord'
  },
  
  sustain: {
    key: ' ',
    description: 'Sustain pedal (momentary)',
    category: 'control'
  },
  
  sustainToggle: {
    key: "\\",
    description: 'Toggle sustain mode',
    category: 'control'
  },
  
  octaveDown: {
    key: 'z',
    description: 'Decrease octave',
    category: 'octave'
  },
  
  octaveUp: {
    key: 'x',
    description: 'Increase octave',
    category: 'octave'
  },
  
  voicingDown: {
    key: 'c',
    description: 'Decrease chord voicing',
    category: 'velocity'
  },
  
  voicingUp: {
    key: 'v',
    description: 'Increase chord voicing',
    category: 'velocity'
  }
};

// Helper functions to get shortcuts by category
export const getShortcutsByCategory = (shortcuts: KeyboardShortcuts, category: KeyboardShortcut['category']) => {
  return Object.entries(shortcuts).filter(([, shortcut]) => shortcut.category === category);
};

export const getChordModifierKeys = (shortcuts: KeyboardShortcuts): string[] => {
  return [
    shortcuts.dominant7.key,
    shortcuts.major7.key,
    shortcuts.sus2.key,
    shortcuts.sus4.key,
    shortcuts.majMinToggle.key
  ];
}; 

// Helper function to convert keys to readable display names
export const getKeyDisplayName = (key: string): string => {
  switch (key) {
    case ' ':
      return 'SPACE';
    case '\\':
      return '\\';
    case 'shift':
      return 'SHIFT';
    case 'ctrl':
      return 'CTRL';
    case 'alt':
      return 'ALT';
    case 'meta':
      return 'META';
    case 'enter':
      return 'ENTER';
    case 'tab':
      return 'TAB';
    case 'escape':
      return 'ESC';
    case 'backspace':
      return 'BACKSPACE';
    case 'delete':
      return 'DEL';
    case 'arrowup':
      return '↑';
    case 'arrowdown':
      return '↓';
    case 'arrowleft':
      return '←';
    case 'arrowright':
      return '→';
    default:
      return key.toUpperCase();
  }
}; 