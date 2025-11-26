/**
 * Safari-specific performance optimizations
 * 
 * Safari has different performance characteristics compared to Chrome/Edge:
 * - Different GPU acceleration behavior
 * - Stricter memory management
 * - Different audio processing pipeline
 * - More conservative threading model
 */

import { isSafari, isSafariMobile } from './webkitCompat';

/**
 * Get Safari-optimized polyphony limits
 * Safari needs lower polyphony to maintain stable performance
 */
export const getSafariPolyphonyLimit = (basePolyphony: number): number => {
  if (!isSafari()) return basePolyphony;
  
  // Safari mobile needs even more aggressive limits
  if (isSafariMobile()) {
    return Math.floor(basePolyphony * 0.4); // 40% of base
  }
  
  // Safari desktop can handle about 60% of Chrome's polyphony
  return Math.floor(basePolyphony * 0.6);
};

/**
 * Get Safari-optimized update intervals
 * Safari benefits from slightly slower update rates
 */
export const getSafariUpdateInterval = (baseInterval: number): number => {
  if (!isSafari()) return baseInterval;
  
  // Safari mobile needs slower updates
  if (isSafariMobile()) {
    return baseInterval * 2.0; // 2x slower
  }
  
  // Safari desktop needs moderately slower updates
  return baseInterval * 1.5; // 1.5x slower
};

/**
 * Get Safari-optimized canvas pixel ratio
 * Safari's GPU acceleration works differently than Chrome
 */
export const getSafariPixelRatio = (): number => {
  if (!isSafari()) {
    return Math.min(window.devicePixelRatio, 2);
  }
  
  // Safari mobile: always use 1x
  if (isSafariMobile()) {
    return 1;
  }
  
  // Safari desktop: cap at 1.5x even on retina displays
  return Math.min(window.devicePixelRatio, 1.5);
};

/**
 * Get Safari-optimized throttle delay for UI updates
 */
export const getSafariThrottleDelay = (baseDelay: number): number => {
  if (!isSafari()) return baseDelay;
  
  // Safari mobile needs more throttling
  if (isSafariMobile()) {
    return Math.max(baseDelay * 2, 16); // At least 16ms (60fps)
  }
  
  // Safari desktop needs moderate throttling
  return Math.max(baseDelay * 1.5, 12); // At least 12ms (~83fps)
};

/**
 * Check if Safari should use simplified rendering
 * Some visual effects should be disabled on Safari for performance
 */
export const shouldUseSafariSimplifiedRendering = (): boolean => {
  return isSafari();
};

/**
 * Get Safari-optimized audio buffer size
 * Safari's audio processing pipeline has different optimal buffer sizes
 */
export const getSafariAudioBufferSize = (baseSize: number): number => {
  if (!isSafari()) return baseSize;
  
  // Safari mobile needs larger buffers for stability
  if (isSafariMobile()) {
    return Math.max(baseSize * 2, 512);
  }
  
  // Safari desktop can use moderately larger buffers
  return Math.max(baseSize * 1.5, 256);
};

/**
 * Get Safari-optimized sample rate
 * Safari works best with specific sample rates
 */
export const getSafariOptimalSampleRate = (): number => {
  // Safari works best with 48kHz (WebRTC standard)
  // Avoid 44.1kHz as it may cause resampling issues
  return 48000;
};

/**
 * Check if Safari should disable certain audio effects
 * Some effects are too CPU-intensive for Safari
 */
export const shouldDisableSafariEffect = (effectType: string): boolean => {
  if (!isSafari()) return false;
  
  // Safari mobile should disable most effects
  if (isSafariMobile()) {
    return ['reverb', 'delay', 'chorus', 'flanger'].includes(effectType);
  }
  
  // Safari desktop can handle basic effects but not complex ones
  return ['reverb', 'chorus', 'flanger'].includes(effectType);
};

/**
 * Get Safari-specific WebRTC configuration adjustments
 */
export const getSafariWebRTCConfig = () => {
  if (!isSafari()) return null;
  
  return {
    // Safari needs smaller ICE candidate pool
    iceCandidatePoolSize: 5,
    
    // Safari needs max-compat bundle policy
    bundlePolicy: 'max-compat' as RTCBundlePolicy,
    
    // Safari doesn't support some newer options
    disableAdvancedFeatures: true,
    
    // Safari needs more time for ICE gathering
    iceGatheringTimeout: 10000, // 10 seconds
  };
};

/**
 * Log Safari-specific performance warnings
 */
export const logSafariPerformanceWarnings = () => {
  if (!isSafari()) return;
  
  console.log('🍎 Safari Performance Mode Active:');
  console.log('  - Reduced polyphony for stability');
  console.log('  - Optimized update intervals');
  console.log('  - Safe oscillator types only');
  console.log('  - Extended audio loading timeouts');
  
  if (isSafariMobile()) {
    console.log('  - Mobile optimizations enabled');
    console.log('  - Some effects disabled for performance');
  }
};

/**
 * Apply Safari-specific performance optimizations globally
 */
export const applySafariPerformanceOptimizations = () => {
  if (!isSafari()) return;
  
  // Log that Safari optimizations are active
  logSafariPerformanceWarnings();
  
  // Disable certain browser features that can interfere with audio
  if (isSafariMobile()) {
    // Disable iOS Safari bounce scroll
    document.body.style.overscrollBehavior = 'none';
    
    // Prevent pinch zoom
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  // Add Safari-specific meta tags for better performance
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && isSafariMobile()) {
    const content = viewport.getAttribute('content') || '';
    if (!content.includes('user-scalable=no')) {
      viewport.setAttribute('content', content + ', user-scalable=no');
    }
  }
};
