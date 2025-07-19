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
export const createWebKitCompatibleAudioContext = async (): Promise<AudioContext> => {
  // Use webkitAudioContext for older Safari versions
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  if (!AudioContextClass) {
    throw new Error("AudioContext not supported in this browser");
  }
  
  const context = new AudioContextClass();
  
  // Safari requires explicit resume after user gesture
  if (context.state === "suspended") {
    try {
      await context.resume();
      
      // Extra wait for Safari to properly initialize
      if (isSafari()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn("Failed to resume AudioContext:", error);
      throw error;
    }
  }
  
  return context;
};

// Safari-specific audio decoding error handling
export const handleSafariAudioError = (error: any, instrumentName: string): Error => {
  if (isSafari() && error.name === "EncodingError") {
    return new Error(
      `Safari audio decoding failed for ${instrumentName}. ` +
      `This may be due to Safari's audio format restrictions or codec compatibility issues.`
    );
  }
  
  if (isSafari() && error.message?.includes("decoding")) {
    return new Error(
      `Safari audio decoding error: ${error.message}. ` +
      `Try refreshing the page or switching to a different instrument.`
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
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'manipulation'
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
    return "Safari requires user interaction before audio can play. Make sure you've clicked the \"Initialize Audio\" button and allowed audio permissions.";
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
    document.body.style.overscrollBehavior = 'none';
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  // Add Safari-specific meta tags for better audio performance
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && isSafariMobile()) {
    viewport.setAttribute('content', 
      viewport.getAttribute('content') + ', user-scalable=no'
    );
  }
};

// Initialize Safari compatibility on app start
export const initSafariCompatibility = () => {
  if (isSafari()) {
    console.log('Safari detected, applying compatibility measures...');
    applySafariBestPractices();
    
    if (hasSafariAudioIssues()) {
      console.warn(
        'This Safari version has known Web Audio API issues. ' +
        'Some instruments may not load properly.'
      );
    }
  }
}; 