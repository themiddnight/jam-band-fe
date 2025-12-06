# Sequencer Feature

This directory contains the implementation of the Step Sequencer for Jam Band. The sequencer allows users to create rhythmic patterns and melodies using a grid-based interface.

## Architecture

The sequencer functionality is split into several layers to separate UI, state management, and audio/timing logic.

### 1. Components (`components/`)
- **StepSequencer.tsx**: The main container component. It handles the layout of controls and the grid.
- **KonvaStepGrid.tsx**: A high-performance grid renderer using `react-konva`.
- **controls/**: Smaller UI components for playback, bank selection, settings, etc.

### 2. Hooks (`hooks/`)
The logic is decomposed into smaller hooks, composed by `useSequencer`:
- **useSequencer.ts**: The main entry point. It initializes the service and combines all sub-hooks.
- **useSequencerLogic.ts**: Handles core sequencing logic like note scheduling, legato detection, and playback callbacks.
- **useSequencerSync.ts**: Manages synchronization with the backend/socket and the `SequencerService`.
- **useSequencerPlayback.ts**: Handles playback controls (play, stop, pause).
- **useSequencerActions.ts**: Actions for modifying steps, settings, and presets.
- **useSequencerBank.ts**: Manages bank switching logic.

### 3. Services (`services/`)
- **SequencerService.ts**: A class-based service that handles the precise timing loop (using `worker-timers` or `Tone.js` transport concepts indirectly via `MetronomeSocketService` sync). It manages the "playing" state and emits step events.
- **SequencerWorkerService.ts**: Manages the Web Worker for off-main-thread timing to prevent UI blocking.

### 4. Store (`stores/`)
- **sequencerStore.ts**: A Zustand store that holds the persistent state:
  - `banks`: The step data (A, B, C, D).
  - `settings`: BPM (local override), length, speed, direction.
  - `currentBank`, `currentBeat`: Playback state.
  - `presets`: User saved presets.

## Key Concepts

### Banks
The sequencer has 4 banks (A, B, C, D). Each bank holds an independent pattern.
- **Single Mode**: Plays one bank continuously.
- **Continuous Mode**: Plays enabled banks in sequence (A -> B -> C -> D -> A...).

### Synchronization
The sequencer synchronizes with the global Room Metronome.
- `useSequencerSync` listens to metronome ticks to keep the local sequencer in sync with other users.
- `SequencerService` schedules lookahead events to ensure audio is triggered precisely.

### Performance
- **Konva**: Used for the grid to handle 64 steps x N rows without DOM overhead.
- **useShallow**: Used in `useSequencer` to prevent unnecessary re-renders when store state changes.
- **Web Worker**: Timing is handled in a worker to avoid jitter from the main thread.
