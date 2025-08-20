import { useState, useEffect, useRef, useCallback } from 'react';
import { RTC_MEASURE_INTERVAL_MS, RTC_UI_THROTTLE_MS } from '@/features/audio/constants/intervals';

interface RTCLatencyMeasurement {
  latency: number;
  timestamp: number;
  userId: string;
}

interface UseRTCLatencyMeasurementOptions {
  enabled?: boolean;
  interval?: number;
  maxHistory?: number;
  // New option to use WebRTC mesh manager for latency measurement
  useWebRTCMeshManager?: boolean;
  webRTCMeshManager?: {
    getWebRTCLatencyStats: () => Array<{ userId: string; currentLatency: number | null; averageLatency: number | null }>;
  };
}

export function useRTCLatencyMeasurement({
  enabled = true,
  interval = RTC_MEASURE_INTERVAL_MS,
  maxHistory = 5,
  useWebRTCMeshManager = false,
  webRTCMeshManager
}: UseRTCLatencyMeasurementOptions = {}) {
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [averageLatency, setAverageLatency] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  
  const latencyHistoryRef = useRef<RTCLatencyMeasurement[]>([]);
  const intervalRef = useRef<number | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const bufferedLatencyRef = useRef<number | null>(null);
  const updateTimerRef = useRef<number | null>(null);
  const UI_THROTTLE = RTC_UI_THROTTLE_MS;

  // Calculate average latency from history
  const calculateAverageLatency = useCallback(() => {
    const history = latencyHistoryRef.current;
    if (history.length === 0) return null;
    
    const sum = history.reduce((acc, measurement) => acc + measurement.latency, 0);
    return Math.round(sum / history.length);
  }, []);

  // Measure RTC latency using RTCPeerConnection stats or WebRTC mesh manager
  const measureRTCLatency = useCallback(async () => {
    if (!enabled) return;

    // Use WebRTC mesh manager if available and enabled
    if (useWebRTCMeshManager && webRTCMeshManager) {
      const stats = webRTCMeshManager.getWebRTCLatencyStats();
      
      if (stats.length === 0) {
        setIsActive(false);
        return;
      }

      // Calculate average latency from all connected users
      const validLatencies = stats
        .map(stat => stat.currentLatency)
        .filter((latency): latency is number => latency !== null);

      if (validLatencies.length > 0) {
        const avgLatency = Math.round(validLatencies.reduce((sum, latency) => sum + latency, 0) / validLatencies.length);

        // Store measurements for history
        stats.forEach(stat => {
          if (stat.currentLatency !== null) {
            const measurement: RTCLatencyMeasurement = {
              latency: stat.currentLatency,
              timestamp: Date.now(),
              userId: stat.userId,
            };
            latencyHistoryRef.current.push(measurement);
          }
        });

        // Buffer UI updates to avoid frequent re-renders
        bufferedLatencyRef.current = avgLatency;
        if (!updateTimerRef.current) {
          updateTimerRef.current = window.setTimeout(() => {
            setCurrentLatency(bufferedLatencyRef.current);
            // Keep only recent measurements
            if (latencyHistoryRef.current.length > maxHistory) {
              latencyHistoryRef.current = latencyHistoryRef.current.slice(-maxHistory);
            }
            setAverageLatency(calculateAverageLatency());
            setIsActive(true);
            updateTimerRef.current = null;
          }, UI_THROTTLE);
        }
      } else {
        setIsActive(false);
      }
      return;
    }

    // Fallback to direct peer connection measurement
    if (peersRef.current.size === 0) return;

    let totalLatency = 0;
    let validMeasurements = 0;

    for (const [userId, peerConnection] of peersRef.current.entries()) {
      try {
        // Accept RTCPeerConnection as connected when either connectionState is 'connected'
        // or ICE connection state is 'completed' (some browsers report completed via iceConnectionState)
        if (peerConnection.connectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') continue;

        const stats = await peerConnection.getStats();
        
        for (const report of stats.values()) {
          // Look for candidate-pair stats that indicate round-trip time
          if (report.type === 'candidate-pair') {
            // Some browsers use 'state' === 'succeeded', others mark 'selected' === true
            const isSelected = (report as any).state === 'succeeded' || (report as any).selected === true || (report as any).nominated === true;

            if (!isSelected) continue;

            // Try a few possible RTT field names for compatibility
            const rtt = (report as any).currentRoundTripTime ?? (report as any).roundTripTime ?? (report as any).rtt;
            if (typeof rtt === 'number' && rtt > 0) {
              const latencyMs = rtt * 1000; // Convert to milliseconds
              totalLatency += latencyMs;
              validMeasurements++;

              // Store individual measurement
              const measurement: RTCLatencyMeasurement = {
                latency: latencyMs,
                timestamp: Date.now(),
                userId,
              };

              latencyHistoryRef.current.push(measurement);
              break; // Only take one measurement per peer
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get RTC stats for user ${userId}:`, error);
      }
    }

    if (validMeasurements > 0) {
      const avgLatency = Math.round(totalLatency / validMeasurements);

      // Buffer UI updates to avoid frequent re-renders
      bufferedLatencyRef.current = avgLatency;
      if (!updateTimerRef.current) {
        updateTimerRef.current = window.setTimeout(() => {
          setCurrentLatency(bufferedLatencyRef.current);
          // Keep only recent measurements
          if (latencyHistoryRef.current.length > maxHistory) {
            latencyHistoryRef.current = latencyHistoryRef.current.slice(-maxHistory);
          }
          setAverageLatency(calculateAverageLatency());
          setIsActive(true);
          updateTimerRef.current = null;
        }, UI_THROTTLE);
      }
    } else {
      setIsActive(false);
    }
  }, [enabled, maxHistory, calculateAverageLatency, UI_THROTTLE, useWebRTCMeshManager, webRTCMeshManager]);

  // Start latency measurements
  const startLatencyMeasurement = useCallback(() => {
  if (intervalRef.current || !enabled) return;

  // Send initial measurement
  measureRTCLatency();

  // Set up interval (use window.setInterval id type)
  intervalRef.current = window.setInterval(measureRTCLatency, interval);
  }, [measureRTCLatency, interval, enabled]);

  // Stop latency measurements
  const stopLatencyMeasurement = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    setIsActive(false);
  }, []);

  // Reset measurements
  const resetLatencyMeasurement = useCallback(() => {
    setCurrentLatency(null);
    setAverageLatency(null);
    setIsActive(false);
    latencyHistoryRef.current = [];
  }, []);

  // Add peer connection for monitoring
  const addPeerConnection = useCallback((userId: string, peerConnection: RTCPeerConnection) => {
    peersRef.current.set(userId, peerConnection);
    
    // Start monitoring if this is the first peer and enabled
    if (enabled && peersRef.current.size === 1) {
      startLatencyMeasurement();
    }
  }, [enabled, startLatencyMeasurement]);

  // Remove peer connection
  const removePeerConnection = useCallback((userId: string) => {
    peersRef.current.delete(userId);
    
    // Stop monitoring if no peers left
    if (peersRef.current.size === 0) {
      stopLatencyMeasurement();
      resetLatencyMeasurement();
    }
  }, [stopLatencyMeasurement, resetLatencyMeasurement]);

  // Clear all peer connections
  const clearAllPeerConnections = useCallback(() => {
    peersRef.current.clear();
    stopLatencyMeasurement();
    resetLatencyMeasurement();
  }, [stopLatencyMeasurement, resetLatencyMeasurement]);

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled) {
      stopLatencyMeasurement();
      resetLatencyMeasurement();
    } else if (peersRef.current.size > 0) {
      startLatencyMeasurement();
    }
  }, [enabled, startLatencyMeasurement, stopLatencyMeasurement, resetLatencyMeasurement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLatencyMeasurement();
    };
  }, [stopLatencyMeasurement]);

  return {
    currentLatency,
    averageLatency,
    isActive,
    isEnabled: enabled,
    addPeerConnection,
    removePeerConnection,
    clearAllPeerConnections,
    resetLatencyMeasurement,
    measureRTCLatency
  };
}
