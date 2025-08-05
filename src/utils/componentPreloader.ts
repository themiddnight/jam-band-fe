// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload keyboard component as it's most commonly used
  import("../components/Keyboard");
};

// Preload function for instrument-specific components
export const preloadInstrumentComponents = (instrumentType: string) => {
  switch (instrumentType) {
    case "guitar":
      import("../components/Guitar");
      break;
    case "bass":
      import("../components/Bass");
      break;
    case "drumpad":
      import("../components/Drumpad");
      break;
    case "drumset":
      import("../components/Drumset");
      break;
    case "synthesizer":
      import("../components/Synthesizer/SynthControls");
      break;
    default:
      break;
  }
};
