const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiNumberToNoteName = (midi: number) => {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

export const noteNameToMidi = (noteName: string) => {
  const match = noteName.match(/^([A-Ga-g])(#|b)?(-?\d+)$/);
  if (!match) {
    return null;
  }
  const [, rawNote, accidental, octaveString] = match;
  const octave = parseInt(octaveString, 10);
  const baseIndex = NOTE_NAMES.findIndex(
    (note) => note[0].toUpperCase() === rawNote.toUpperCase()
  );
  if (baseIndex === -1) {
    return null;
  }
  let index = baseIndex;
  if (accidental === '#') {
    index += 1;
  } else if (accidental === 'b') {
    index -= 1;
  }
  if (index < 0) {
    index += 12;
  }
  if (index >= 12) {
    index -= 12;
  }
  return index + (octave + 1) * 12;
};

export const velocityToGain = (velocity: number) => {
  const clamped = Math.min(Math.max(velocity, 0), 127);
  return clamped / 127;
};

export const clampMidiValue = (value: number, min = 0, max = 127) =>
  Math.min(Math.max(value, min), max);

