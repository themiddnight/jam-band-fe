import { AudioContextManager } from "../constants/audioConfig";
import { useCallback, useEffect, useRef } from "react";

/**
 * Hook for managing audio performance optimization when WebRTC is active
 */
export const usePerformanceOptimization = () => {
  const performanceMonitorRef = useRef<number | null>(null);
  const lastWebRTCStateRef = useRef<boolean>(false);

  // Monitor WebRTC state and adjust instrument performance
  const monitorPerformance = useCallback(() => {
    const isWebRTCActive = AudioContextManager.isWebRTCActive();

    // Only trigger changes when state actually changes
    if (isWebRTCActive !== lastWebRTCStateRef.current) {
      lastWebRTCStateRef.current = isWebRTCActive;

      if (isWebRTCActive) {
        console.log(
          "🎵 Performance: WebRTC detected, optimizing instrument performance",
        );
        // Optionally reduce instrument context priority
        // This could trigger polyphony reduction in instruments
        window.dispatchEvent(
          new CustomEvent("webrtc-active", { detail: { active: true } }),
        );
      } else {
        console.log(
          "🎵 Performance: WebRTC inactive, restoring full instrument performance",
        );
        // Restore full performance
        window.dispatchEvent(
          new CustomEvent("webrtc-active", { detail: { active: false } }),
        );
      }
    }
  }, []);

  // Start performance monitoring
  const startPerformanceMonitoring = useCallback(() => {
    if (performanceMonitorRef.current) return;

    performanceMonitorRef.current = setInterval(
      monitorPerformance,
      2000,
    ) as unknown as number;
    console.log("🔍 Performance: Started audio performance monitoring");
  }, [monitorPerformance]);

  // Stop performance monitoring
  const stopPerformanceMonitoring = useCallback(() => {
    if (performanceMonitorRef.current) {
      clearInterval(performanceMonitorRef.current);
      performanceMonitorRef.current = null;
      console.log("🛑 Performance: Stopped audio performance monitoring");
    }
  }, []);

  // Suspend instruments when not needed
  const suspendInstruments = useCallback(async () => {
    try {
      await AudioContextManager.suspendInstrumentContext();
      console.log(
        "⏸️ Performance: Suspended instrument audio context to save CPU",
      );
    } catch (error) {
      console.warn("Failed to suspend instrument context:", error);
    }
  }, []);

  // Resume instruments
  const resumeInstruments = useCallback(async () => {
    try {
      await AudioContextManager.resumeInstrumentContext();
      console.log("▶️ Performance: Resumed instrument audio context");
    } catch (error) {
      console.warn("Failed to resume instrument context:", error);
    }
  }, []);

  // Auto-start monitoring on mount
  useEffect(() => {
    startPerformanceMonitoring();
    return () => {
      stopPerformanceMonitoring();
    };
  }, [startPerformanceMonitoring, stopPerformanceMonitoring]);

  return {
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    suspendInstruments,
    resumeInstruments,
    isWebRTCActive: () => AudioContextManager.isWebRTCActive(),
    getMaxPolyphony: () => AudioContextManager.getMaxPolyphony(),
  };
};
