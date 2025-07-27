# Guitar Component Improvements

This document describes the improved guitar fretboard feature with intuitive playing modes similar to the virtual keyboard.

## Overview

The guitar component now supports three distinct playing modes, each designed to provide an intuitive guitar playing experience:

1. **Basic Mode** - Traditional fretboard interface
2. **Simple - Note Mode** - Note buttons with hold-to-sustain functionality
3. **Simple - Chord Mode** - Chord buttons with strum functionality

## Modes

### Basic Mode
- **UI**: Traditional fretboard with strings and frets
- **Functionality**: Click/tap notes on strings to play
- **Sustain**: Full sustain/sustain lock support like virtual keyboard
- **String Handling**: If sustain is active and you play a note on the same string, it stops the previous note (like a real guitar)
- **Shortcuts**: None - pure mouse/touch interaction

### Simple - Note Mode
- **UI**: Note buttons arranged by scale
- **Functionality**: Hold note buttons then hit play button to play notes
- **Sustain**: No sustain/sustain lock - notes sustain as long as you hold the button
- **Muted Notes**: If you hit play without holding any notes, it plays a muted note sound
- **Shortcuts**:
  - Lower octave notes: `ASDFGHJ`
  - Higher octave notes: `QWERTYU`
  - Play notes: `,` and `.`
  - Octave controls: `Z` (down), `X` (up)

### Simple - Chord Mode
- **UI**: Chord buttons for each scale degree
- **Functionality**: Hold chord buttons then hit strum up/down to play chords
- **Sustain**: No sustain/sustain lock - chords sustain as long as you hold the button
- **Snap Sound**: If you hit strum without holding any chords, it plays a snap sound
- **Voicing**: 5 notes per chord at voicing 0, starting from E2
- **Shortcuts**:
  - Strum up/down: `,` and `.`
  - Strum speed: `N` (decrease), `M` (increase) - 3 levels: 50/100/200ms
  - Chord selection: `ASDFGHJ`
  - Velocity: `1-9`
  - Voicing: `C` (down), `V` (up)
  - Chord modifiers:
    - `Q` - Dominant 7
    - `W` - Major 7
    - `E` - Sus2
    - `R` - Sus4
    - `T` - Major/Minor toggle

## File Structure

```
src/components/Guitar/
├── index.tsx                    # Main guitar component
├── README.md                    # This file
├── types/
│   └── guitar.ts               # Guitar-specific types
├── hooks/
│   ├── useGuitarState.ts       # Guitar state management
│   └── useGuitarKeysController.ts # Keyboard shortcuts handling
├── components/
│   ├── BasicFretboard.tsx      # Basic fretboard UI
│   ├── SimpleNoteKeys.tsx      # Simple note mode UI
│   └── SimpleChordKeys.tsx     # Simple chord mode UI
└── constants/
    └── guitarShortcuts.ts      # Guitar keyboard shortcuts
```

## Audio Samples

### Required Audio Files

Place your guitar audio sample files in the following directory:

```
jam-band-fe/public/audio/guitar/
├── muted-note.mp3    # Muted guitar string sound
└── snap-sound.mp3    # Guitar string snap sound
```

### Audio File Requirements

- **Format**: MP3, WAV, or OGG
- **Duration**: 
  - Muted note: 0.5-2 seconds
  - Snap sound: 0.1-0.5 seconds
- **Sample rate**: 44.1kHz recommended
- **Bit depth**: 16-bit or 24-bit

### Optional Additional Samples

You can also add these additional guitar samples for enhanced realism:
- `string-squeak.mp3` - String squeak when sliding
- `fret-noise.mp3` - Fret noise when pressing
- `pick-attack.mp3` - Pick attack sound

## Usage

### Basic Usage

```tsx
import Guitar from './components/Guitar';

<Guitar
  scaleState={scaleState}
  onPlayNotes={handlePlayNotes}
  onStopNotes={handleStopNotes}
  onStopSustainedNotes={handleStopSustainedNotes}
  onReleaseKeyHeldNote={handleReleaseKeyHeldNote}
  onSustainChange={handleSustainChange}
  onSustainToggleChange={handleSustainToggleChange}
/>
```

### Mode Switching

Users can switch between modes using the mode buttons at the top of the guitar component:
- **Basic**: Traditional fretboard
- **Simple - Note**: Note button interface
- **Simple - Chord**: Chord button interface

### Keyboard Shortcuts

All keyboard shortcuts are documented in the component UI and follow the same pattern as the virtual keyboard. The shortcuts are context-aware and only work in the appropriate mode.

## Implementation Notes

### State Management

The guitar component uses a centralized state management system similar to the keyboard:
- `useGuitarState`: Manages all guitar-specific state
- `useGuitarKeysController`: Handles keyboard shortcuts
- `useInstrumentState`: Manages fretboard-specific state

### Component Separation

Each mode is implemented as a separate component:
- `BasicFretboard`: Handles traditional fretboard UI
- `SimpleNoteKeys`: Handles note button interface
- `SimpleChordKeys`: Handles chord button interface

### Audio Integration

The guitar component is prepared for audio sample integration:
- Muted note sounds for simple note mode
- Snap sounds for simple chord mode
- Strum effects for chord playing
- Audio utilities in `guitarAudioUtils.ts`

## Future Enhancements

1. **Strum Effects**: Implement realistic strum timing and effects
2. **Chord Voicings**: Add more sophisticated chord voicing options
3. **Effects**: Add guitar effects like distortion, reverb, etc.
4. **Tuning**: Add support for different guitar tunings
5. **Capo**: Add capo functionality for transposition
6. **Fingerpicking**: Add fingerpicking patterns and techniques

## Troubleshooting

### Audio Samples Not Playing

1. Ensure audio files are placed in the correct directory
2. Check file format and encoding
3. Verify file permissions
4. Check browser console for errors

### Keyboard Shortcuts Not Working

1. Ensure the guitar component has focus
2. Check that you're in the correct mode for the shortcut
3. Verify no other components are capturing the same keys

### Performance Issues

1. Reduce the number of simultaneous notes/chords
2. Optimize audio sample loading
3. Use Web Audio API efficiently
4. Consider audio sample compression 