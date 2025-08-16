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
export { useSocket } from "./hooks/useSocket";
export { usePingMeasurement } from "./hooks/usePingMeasurement";
export { useRTCLatencyMeasurement } from "./hooks/useRTCLatencyMeasurement";

// Store exports
export { useInstrumentPreferencesStore } from "./stores/instrumentPreferencesStore";

// Utilities exports
export { audioBufferCache } from "./utils/audioBufferCache";
export * from "./utils/audioUtils";

// Constants exports
export * from "./constants/audioConfig";
