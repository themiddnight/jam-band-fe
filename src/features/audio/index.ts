// Audio Feature Barrel Export

// Components exports
export { default as MidiStatus } from "./components/MidiStatus";
export { default as VoiceInput } from "./components/VoiceInput";

// Hooks exports
export { useMidiController } from "./hooks/useMidiController";
export { useSustainSync } from "./hooks/useSustainSync";
export { useWebRTCVoice } from "./hooks/useWebRTCVoice";
export { useAudioContextManager } from "./hooks/useAudioContextManager";
export { useSocket } from "./hooks/useSocket";

// Store exports
export { useInstrumentPreferencesStore } from "./stores/instrumentPreferencesStore";

// Utilities exports
export { audioBufferCache } from "./utils/audioBufferCache";

// Constants exports
export * from "./constants/audioConfig";
export { getOptimalAudioConfig } from "./constants/audioConfig";
