import { useEffect, useState } from 'react';
import { AudioContextManager } from '../constants/audioConfig';

/**
 * Hook that listens to WebRTC state changes and provides performance optimization guidance
 * for instruments when WebRTC voice is active.
 */
export const useWebRTCStateListener = () => {
  const [isWebRTCActive, setIsWebRTCActive] = useState(false);
  const [maxPolyphony, setMaxPolyphony] = useState(32);

  useEffect(() => {
    // Initialize state
    const updateState = () => {
      const active = AudioContextManager.isWebRTCActive();
      const polyphony = AudioContextManager.getMaxPolyphony();
      
      setIsWebRTCActive(active);
      setMaxPolyphony(polyphony);
    };

    // Update initial state
    updateState();

    // Listen for WebRTC state changes
    const handleWebRTCStateChange = (event: CustomEvent) => {
      const { isActive } = event.detail;
      setIsWebRTCActive(isActive);
      setMaxPolyphony(AudioContextManager.getMaxPolyphony());
      
      console.log(`🎵 WebRTC State Change: ${isActive ? 'Active' : 'Inactive'} - Max polyphony: ${AudioContextManager.getMaxPolyphony()}`);
    };

    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);

    return () => {
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    };
  }, []);

  return {
    isWebRTCActive,
    maxPolyphony,
    // Helper functions for instruments
    shouldReduceQuality: isWebRTCActive,
    recommendedBufferSize: isWebRTCActive ? 512 : 256,
    recommendedLatencyHint: isWebRTCActive ? 'balanced' as AudioContextLatencyCategory : 'interactive' as AudioContextLatencyCategory,
  };
};
