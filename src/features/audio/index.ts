// Audio Feature Barrel Export

// Components exports
export { default as MidiStatus } from "./components/MidiStatus";
export { default as VoiceInput } from "./components/VoiceInput";
export { default as PingDisplay } from "./components/PingDisplay";
export { default as RTCLatencyDisplay } from "./components/RTCLatencyDisplay";

// Hooks exports
export { useMidiController } from "./hooks/useMidiController";
export { usePerformanceOptimization } from "./hooks/usePerformanceOptimization";
export { useWebRTCStateListener } from "./hooks/useWebRTCStateListener";

// Configuration exports
export { AUDIO_CONFIG, getOptimalAudioConfig, AudioContextManager } from "./constants/audioConfig";
export { useSustainSync } from "./hooks/useSustainSync";
export { useWebRTCVoice } from "./hooks/useWebRTCVoice";
export { useAudioContextManager } from "./hooks/useAudioContextManager";
export { useRoomSocket } from "./hooks/useRoomSocket";
export { usePingMeasurement } from "./hooks/usePingMeasurement";
export { useRTCLatencyMeasurement } from "./hooks/useRTCLatencyMeasurement";
export { useRoomAudio } from "./hooks/useRoomAudio";
export type { UseRoomAudioOptions, UseRoomAudioReturn } from "./hooks/useRoomAudio";

// Types
export { ConnectionState, ConnectionEvent } from "./types/connectionState";
export type { ConnectionConfig, ApprovalRequest } from "./types/connectionState";

// Services
export { RoomSocketManager } from "./services/RoomSocketManager";
export { RoomAudioManager } from "./services/RoomAudioManager";
export type { RoomUser, InstrumentPreloadData } from "./services/RoomAudioManager";

// Store exports
export { useInstrumentPreferencesStore } from "./stores/instrumentPreferencesStore";

// Utilities exports
export { audioBufferCache } from "./utils/audioBufferCache";
export * from "./utils/audioUtils";

// Constants exports
export * from "./constants/audioConfig";
