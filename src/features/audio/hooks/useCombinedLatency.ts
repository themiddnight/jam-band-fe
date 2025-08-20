import { useState, useEffect, useCallback } from 'react';
import { useRTCLatencyMeasurement } from './useRTCLatencyMeasurement';
import { AudioContextManager } from '@/features/audio/constants/audioConfig';

interface UseCombinedLatencyOptions {
  enabled?: boolean;
  interval?: number;
  maxHistory?: number;
  useWebRTCMeshManager?: boolean;
  webRTCMeshManager?: {
    getWebRTCLatencyStats: () => Array<{ userId: string; currentLatency: number | null; averageLatency: number | null }>;
  };
}

export function useCombinedLatency(options: UseCombinedLatencyOptions = {}) {
  const [browserAudioLatency, setBrowserAudioLatency] = useState<number>(0);
  const [totalLatency, setTotalLatency] = useState<number | null>(null);
  
  // Use the existing RTC latency measurement hook
  const rtcLatencyHook = useRTCLatencyMeasurement(options);
  
  // Measure browser audio processing latency
  const measureBrowserAudioLatency = useCallback(() => {
    try {
      const webrtcContext = AudioContextManager.getWebRTCContext();
      if (webrtcContext && webrtcContext.state === 'running') {
        // Get browser audio processing latency (baseLatency + outputLatency)
        const baseLatency = webrtcContext.baseLatency || 0;
        const outputLatency = webrtcContext.outputLatency || 0;
        const totalBrowserLatency = (baseLatency + outputLatency) * 1000; // Convert to milliseconds
        
        setBrowserAudioLatency(Math.round(totalBrowserLatency));
        
        // Calculate total latency (browser + mesh)
        if (rtcLatencyHook.currentLatency !== null) {
          const combinedLatency = Math.round(totalBrowserLatency) + rtcLatencyHook.currentLatency;
          setTotalLatency(combinedLatency);
        }
      }
    } catch (error) {
      console.warn('Failed to measure browser audio latency:', error);
      // Fallback to estimated browser latency based on common values
      setBrowserAudioLatency(15); // Common browser audio processing latency
    }
  }, [rtcLatencyHook.currentLatency]);
  
  // Update total latency whenever RTC latency changes
  useEffect(() => {
    if (rtcLatencyHook.currentLatency !== null) {
      const combinedLatency = browserAudioLatency + rtcLatencyHook.currentLatency;
      setTotalLatency(combinedLatency);
    } else {
      setTotalLatency(null);
    }
  }, [rtcLatencyHook.currentLatency, browserAudioLatency]);
  
  // Measure browser latency periodically
  useEffect(() => {
    if (!options.enabled) return;
    
    // Initial measurement
    measureBrowserAudioLatency();
    
    // Measure every 2 seconds to catch changes in browser audio context
    const interval = setInterval(measureBrowserAudioLatency, 2000);
    
    return () => clearInterval(interval);
  }, [options.enabled, measureBrowserAudioLatency]);
  
  return {
    // Combined latency (browser + mesh)
    totalLatency,
    // Individual components
    browserAudioLatency,
    meshLatency: rtcLatencyHook.currentLatency,
    // RTC hook properties
    isActive: rtcLatencyHook.isActive,
    isEnabled: rtcLatencyHook.isEnabled,
    // RTC hook methods
    addPeerConnection: rtcLatencyHook.addPeerConnection,
    removePeerConnection: rtcLatencyHook.removePeerConnection,
    clearAllPeerConnections: rtcLatencyHook.clearAllPeerConnections,
    resetLatencyMeasurement: rtcLatencyHook.resetLatencyMeasurement,
    measureRTCLatency: rtcLatencyHook.measureRTCLatency,
  };
} 