// Base instrument store for common functionality
export { useBaseInstrumentStore } from "./baseInstrumentStore";

// Instrument-specific stores
export { useKeyboardStore } from "./keyboardStore";
export { useGuitarStore } from "./guitarStore";
export { useDrumStore } from "./drumStore";
export { useBassStore } from "./bassStore";

// Specialized stores
export { useInstrumentPreferencesStore } from "./instrumentPreferencesStore";
export { useDrumpadPresetsStore } from "./drumpadPresetsStore";
export { useScaleSlotsStore } from "./scaleSlotsStore";

// Room and user management
export { useRoomStore } from "./roomStore";
export { useUserStore } from "./userStore";
