// Safari/WebKit compatibility utilities

export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const isWebKit = (): boolean => {
  return /webkit/i.test(navigator.userAgent);
};

export const isMobile = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const isSafariMobile = (): boolean => {
  return isSafari() && isMobile();
};

export const getSafariVersion = (): number | null => {
  const match = navigator.userAgent.match(/Version\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

// WebKit/Safari specific audio context helpers
export const createWebKitCompatibleAudioContext =
  async (): Promise<AudioContext> => {
    // Use webkitAudioContext for older Safari versions
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AudioContext not supported in this browser");
    }

    const context = new AudioContextClass();

    // Safari requires explicit resume after user gesture and proper initialization
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch (error) {
        console.warn("Failed to resume AudioContext:", error);
        throw error;
      }
    }

    // Ensure AudioDestinationNode is properly initialized in Safari
    if (isSafari()) {
      try {
        // Force Safari to initialize the destination node by creating a minimal test node
        const testOsc = context.createOscillator();
        const testGain = context.createGain();
        
        testOsc.connect(testGain);
        testGain.connect(context.destination);
        testGain.gain.value = 0; // Silent
        
        testOsc.start(context.currentTime);
        testOsc.stop(context.currentTime + 0.001); // Very brief
        
        // Extra wait for Safari to properly initialize
        await new Promise((resolve) => setTimeout(resolve, 150));
        
        console.log('🍎 Safari AudioContext initialized with destination node verification');
      } catch (error) {
        console.warn("Safari AudioDestinationNode initialization failed:", error);
        throw new Error(`AudioDestinationNode is not initialized: ${error}`);
      }
    }

    return context;
  };

// Safari-specific audio decoding error handling
export const handleSafariAudioError = (
  error: any,
  instrumentName: string,
): Error => {
  if (isSafari() && error.name === "EncodingError") {
    return new Error(
      `Safari audio decoding failed for ${instrumentName}. ` +
        `This may be due to Safari's audio format restrictions or codec compatibility issues.`,
    );
  }

  if (isSafari() && error.message?.includes("decoding")) {
    return new Error(
      `Safari audio decoding error: ${error.message}. ` +
        `Try refreshing the page or switching to a different instrument.`,
    );
  }

  return error;
};

// Safari-specific touch event helpers
export const getSafariTouchDelay = (): number => {
  return isSafariMobile() ? 10 : 0;
};

export const getSafariReleaseDelay = (): number => {
  return isSafariMobile() ? 20 : 0;
};

// WebKit-specific CSS properties for touch optimization
export const getWebKitTouchStyles = (): React.CSSProperties => {
  return {
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    touchAction: "manipulation",
  };
};

// Safari-specific instrument loading timeouts
export const getSafariLoadTimeout = (baseTimeout: number = 10000): number => {
  return isSafari() ? baseTimeout * 1.5 : baseTimeout;
};

// Check if current Safari version has known audio issues
export const hasSafariAudioIssues = (): boolean => {
  if (!isSafari()) return false;

  const version = getSafariVersion();
  if (!version) return true; // Assume issues if version is unknown

  // Safari versions with known Web Audio issues
  // Based on the bug reports we found
  return version >= 14 && version <= 15;
};

// Get user-friendly error messages for Safari users
export const getSafariUserMessage = (error: string): string => {
  if (!isSafari()) return error;

  if (error.includes("decoding") || error.includes("EncodingError")) {
    return "Safari is having trouble loading this audio sample. The app will automatically try Safari-compatible instruments.";
  }

  if (error.includes("AudioContext")) {
    return 'Safari requires user interaction before audio can play. Make sure you\'ve clicked the "Initialize Audio" button and allowed audio permissions.';
  }

  if (error.includes("timeout")) {
    return "Safari is taking longer than usual to load the audio. This is normal - Safari sometimes needs extra time to process audio samples.";
  }

  if (error.includes("Switching to synthesizer mode")) {
    return "Safari cannot load audio samples. Using built-in synthesizer instead for best compatibility.";
  }

  return error;
};

// Safari-specific best practices
export const applySafariBestPractices = () => {
  if (!isSafari()) return;

  // Disable iOS Safari bounce scroll
  if (isSafariMobile()) {
    document.body.style.overscrollBehavior = "none";
    document.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  // Add Safari-specific meta tags for better audio performance
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && isSafariMobile()) {
    viewport.setAttribute(
      "content",
      viewport.getAttribute("content") + ", user-scalable=no",
    );
  }
};

// Initialize Safari compatibility on app start
export const initSafariCompatibility = () => {
  if (isSafari()) {
    applySafariBestPractices();

    if (hasSafariAudioIssues()) {
      console.warn(
        "This Safari version has known Web Audio API issues. " +
          "Some instruments may not load properly.",
      );
    }
  }
};

// Safari-compatible instrument fallback utilities
// This system uses dynamic fallback instead of hardcoded lists:
// 1. Try to load the selected instrument
// 2. If it fails with Safari audio errors, find the next instrument in the category
// 3. Continue until a working instrument is found or all instruments are exhausted
export const findNextCompatibleInstrument = async (
  currentInstrument: string,
  category: string,
  failedInstruments: Set<string> = new Set(),
): Promise<string | null> => {
  // Import instruments dynamically to avoid circular dependencies
  const instrumentsModule = await import("../constants/instruments");
  const { SOUNDFONT_INSTRUMENTS, SYNTHESIZER_INSTRUMENTS, DRUM_MACHINES } =
    instrumentsModule;

  let instruments: Array<{ value: string; label: string; controlType: any }> =
    [];

  switch (category) {
    case "melodic":
      instruments = SOUNDFONT_INSTRUMENTS;
      break;
    case "synthesizer":
      instruments = SYNTHESIZER_INSTRUMENTS;
      break;
    case "drum_beat":
      instruments = DRUM_MACHINES;
      break;
    default:
      return null;
  }

  // Find the current instrument index
  const currentIndex = instruments.findIndex(
    (instr) => instr.value === currentInstrument,
  );
  if (currentIndex === -1) {
    // If current instrument not found, start from the beginning
    for (let i = 0; i < instruments.length; i++) {
      if (!failedInstruments.has(instruments[i].value)) {
        return instruments[i].value;
      }
    }
    return null;
  }

  // Try instruments after the current one
  for (let i = currentIndex + 1; i < instruments.length; i++) {
    if (!failedInstruments.has(instruments[i].value)) {
      return instruments[i].value;
    }
  }

  // If we reach the end, try instruments before the current one
  for (let i = 0; i < currentIndex; i++) {
    if (!failedInstruments.has(instruments[i].value)) {
      return instruments[i].value;
    }
  }

  return null;
};
