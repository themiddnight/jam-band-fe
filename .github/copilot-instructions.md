# COLLAB Jam Band Frontend - AI Coding Instructions

## Project Overview
Real-time collaborative music-making web app optimizing for **ultra-low latency over audio quality**. Built with React 19, TypeScript, Vite, and Web Audio API for virtual instruments and WebRTC voice chat.

## Architecture Principles

### Feature-Based Structure
- **Feature modules** in `/src/features/` follow strict barrel export pattern via `index.ts`
- Each feature has: `components/`, `hooks/`, `stores/`, `services/`, `types/`, `constants/`, `utils/`
- Import features via barrel exports: `import { useRoom } from "@/features/rooms"`

### State Management Patterns
- **Zustand stores** for feature-specific state (see `src/features/*/stores/`)
- Stores use factory pattern: `createInstrumentStore()` for consistent instrument state
- Store composition via custom hooks: `useRoom()` orchestrates multiple stores

### Audio Architecture (Critical)
- **Dual Audio Contexts**: Instruments (`"interactive"` latency) + Voice (separate for isolation)
- **Performance optimization**: Dynamic polyphony reduction during voice calls (32→6 notes)
- **WebRTC Mesh**: Ultra-low latency but participant-limited
- Audio processing at **4ms intervals** - performance is paramount

### Service Layer Patterns
- **Manager classes**: `RoomSocketManager`, `RoomAudioManager`, `AudioContextManager`
- **Namespace-based sockets**: Different Socket.IO namespaces per room
- **Adaptive audio**: `AdaptiveAudioManager` scales quality based on network/performance

## Development Workflows

### Key Commands
```bash
bun dev          # Development with HTTPS (WebRTC requirement)
bun build        # TypeScript build + Vite production
bun test         # Vitest with jsdom
bun lint         # ESLint with React hooks rules
```

### Browser Requirements
- **Chromium-based preferred** (Chrome/Edge/Brave) for full MIDI and synthesizer support
- **WebKit limitations**: Some instruments don't work on Safari
- **HTTPS required** for WebRTC and microphone access

## Code Conventions

### Hook Composition Pattern
```typescript
// Main orchestrator hook (see useRoom.ts)
const useRoom = () => {
  const { currentRoom } = useRoomStore()
  const { playNote } = useInstrument()
  const { socket } = useRoomSocket()
  // Return composed interface
}
```

### Barrel Export Structure
```typescript
// Feature index.ts pattern
export { ComponentName } from "./components/ComponentName"
export { useHookName } from "./hooks/useHookName"
export { storeName } from "./stores/storeName"
export type { TypeName } from "./types"
```

### Performance-Critical Areas
- **Mute state respect**: Always check `isInstrumentMuted` before audio operations
- **Note timing**: Use `useCallback` for note handlers to prevent timing jitter
- **WebRTC isolation**: Never mix instrument audio with WebRTC voice processing
- **Effect pooling**: Reuse audio effect instances (see `effectsArchitecture.ts`)

### Socket Communication
- **Room namespaces**: `/room/${roomId}` for isolated room communication
- **Event patterns**: `onPlayNote`, `onStopNote`, `onInstrumentChange`
- **Cleanup required**: Always cleanup socket listeners and WebRTC connections

### Testing Approach
- **Mock audio APIs**: Web Audio API mocked in `src/test/setup.ts`
- **Component testing**: React Testing Library with jsdom
- **Performance focus**: Test audio latency and cleanup behavior

## Integration Points

### External Dependencies
- **Tone.js**: Synthesizer instruments and effects
- **smplr**: Sample-based instruments (drums, guitar, bass)
- **Socket.IO**: Real-time communication with namespace support
- **WebRTC**: Direct peer-to-peer voice with manual connection management

### Critical Paths
- **Room entry**: Lobby → Room connection → Instrument loading → Audio context init
- **Note playing**: Keyboard input → mute check → audio processing → network broadcast
- **Voice chat**: Separate audio context → WebRTC mesh → latency optimization

## Common Gotchas
- **Audio context** requires user gesture - handle `needsUserGesture` state
- **Instrument loading** is async - respect `isLoadingInstrument` state
- **Scale state** syncs between users - handle owner vs follower modes
- **WebRTC cleanup** required on room leave to prevent memory leaks
- **HTTPS development** needed for microphone access and WebRTC

When implementing features, prioritize audio performance over code elegance, respect the mute state throughout the audio chain, and ensure proper cleanup of audio resources.
