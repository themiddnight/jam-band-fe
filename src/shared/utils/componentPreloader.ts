// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload keyboard component as it's most commonly used
  import("@/features/instruments/components/Keyboard");
};

// Preload function for instrument-specific components
export const preloadInstrumentComponents = (instrumentType: string) => {
  switch (instrumentType) {
    case "guitar":
      import("@/features/instruments/components/Guitar");
      break;
    case "bass":
      import("@/features/instruments/components/Bass");
      break;
    case "drumpad":
      import("@/features/instruments/components/Drumpad");
      break;
    case "drumset":
      import("@/features/instruments/components/Drumset");
      break;
    case "synthesizer":
      import("@/features/instruments/components/Synthesizer/SynthControls");
      break;
    default:
      break;
  }
};
