// Shared Module Barrel Export
// This file will be populated as shared utilities are migrated

// Store exports
export { useUserStore } from "./stores/userStore";
export {
  useScaleSlotsStore,
  type ScaleSlotsState,
} from "./stores/scaleSlotsStore";

// Hooks exports
export { usePWA } from "./hooks/usePWA";

// Component exports
export { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
export { ErrorBoundary } from "./components/ErrorBoundary";

// Utility exports
export * from "./utils";
export {
  preloadCriticalComponents,
  preloadInstrumentComponents,
} from "./utils/componentPreloader";

// Constants exports
export * from "./constants";

// Types exports
export * from "./types";
