import { RTC_MEASURE_INTERVAL_MS } from "@/features/audio/constants/intervals";
import { useState, useEffect, useRef, useCallback } from "react";

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
    getWebRTCLatencyStats: () => Array<{
      userId: string;
      currentLatency: number | null;
      averageLatency: number | null;
    }>;
  };
}

export function useRTCLatencyMeasurement({
  enabled = true,
  interval = RTC_MEASURE_INTERVAL_MS,
  maxHistory = 10, // Increased from 5 to 10 for better averaging
  useWebRTCMeshManager = false,
  webRTCMeshManager,
}: UseRTCLatencyMeasurementOptions = {}) {
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [averageLatency, setAverageLatency] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);

  const latencyHistoryRef = useRef<RTCLatencyMeasurement[]>([]);
  const intervalRef = useRef<number | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const updateTimerRef = useRef<number | null>(null);
  const lastMeasurementRef = useRef<number>(0);

  // Calculate average latency from history with outlier filtering
  const calculateAverageLatency = useCallback(() => {
    const history = latencyHistoryRef.current;
    if (history.length === 0) return null;

    // Sort by timestamp to get recent measurements
    const recentHistory = history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5); // Use only last 5 measurements for more responsive averaging

    if (recentHistory.length === 0) return null;

    // Filter out extreme outliers (more than 3x the median)
    const sortedLatencies = recentHistory
      .map((m) => m.latency)
      .sort((a, b) => a - b);
    const median = sortedLatencies[Math.floor(sortedLatencies.length / 2)];
    const filteredLatencies = sortedLatencies.filter(
      (latency) => latency <= median * 3 && latency >= median / 3,
    );

    if (filteredLatencies.length === 0) return median;

    const sum = filteredLatencies.reduce((acc, latency) => acc + latency, 0);
    return Math.round(sum / filteredLatencies.length);
  }, []);

  // Measure RTC latency using RTCPeerConnection stats or WebRTC mesh manager
  const measureRTCLatency = useCallback(async () => {
    if (!enabled) return;

    const now = Date.now();
    // Prevent measurements too close together
    if (now - lastMeasurementRef.current < 500) return;
    lastMeasurementRef.current = now;

    // Use WebRTC mesh manager if available and enabled
    if (useWebRTCMeshManager && webRTCMeshManager) {
      try {
        const stats = webRTCMeshManager.getWebRTCLatencyStats();

        if (stats.length === 0) {
          setIsActive(false);
          return;
        }

        // Calculate average latency from all connected users
        const validLatencies = stats
          .map((stat) => stat.currentLatency)
          .filter(
            (latency): latency is number => latency !== null && latency >= 0,
          );

        if (validLatencies.length > 0) {
          // Use median for more stable measurements
          const sortedLatencies = validLatencies.sort((a, b) => a - b);
          const medianLatency =
            sortedLatencies[Math.floor(sortedLatencies.length / 2)];
          const avgLatency = Math.round(medianLatency);

          // Store measurements for history
          stats.forEach((stat) => {
            if (stat.currentLatency !== null && stat.currentLatency >= 0) {
              const measurement: RTCLatencyMeasurement = {
                latency: stat.currentLatency,
                timestamp: now,
                userId: stat.userId,
              };
              latencyHistoryRef.current.push(measurement);
            }
          });

          // Update immediately for critical measurements
          setCurrentLatency(avgLatency);
          setIsActive(true);

          // Keep only recent measurements
          if (latencyHistoryRef.current.length > maxHistory) {
            latencyHistoryRef.current =
              latencyHistoryRef.current.slice(-maxHistory);
          }
          setAverageLatency(calculateAverageLatency());
        } else {
          setIsActive(false);
        }
      } catch (error) {
        console.warn("Failed to get WebRTC mesh latency stats:", error);
        setIsActive(false);
      }
      return;
    }

    // Fallback to direct peer connection measurement
    if (peersRef.current.size === 0) {
      setIsActive(false);
      return;
    }

    let totalLatency = 0;
    let validMeasurements = 0;
    const measurements: RTCLatencyMeasurement[] = [];

    for (const [userId, peerConnection] of peersRef.current.entries()) {
      try {
        // WebKit compatibility: Accept connection if:
        // - connectionState is 'connected' (standard)
        // - iceConnectionState is 'completed' or 'connected' (WebKit/Safari)
        // - signalingState is 'stable' with any ice connection (fallback for older WebKit)
        const connectionState = peerConnection.connectionState;
        const iceState = peerConnection.iceConnectionState as string; // Cast for WebKit compatibility
        const signalingState = peerConnection.signalingState;
        
        const isConnected = 
          connectionState === "connected" ||
          iceState === "completed" ||
          iceState === "connected" ||
          (signalingState === "stable" && ["checking", "connected", "completed"].includes(iceState));
        
        if (!isConnected) {
          continue;
        }

        const stats = await peerConnection.getStats();
        let foundRtt = false;

        for (const report of stats.values()) {
          // Look for candidate-pair stats that indicate round-trip time
          if (report.type === "candidate-pair") {
            // WebKit compatibility: Check multiple selection criteria
            // Safari may use different fields than Chrome/Firefox
            const reportAny = report as any;
            const isSelected =
              reportAny.state === "succeeded" ||
              reportAny.state === "in-progress" || // WebKit may report in-progress for active pairs
              reportAny.selected === true ||
              reportAny.nominated === true ||
              reportAny.writable === true; // WebKit uses writable for active pairs

            if (!isSelected) continue;

            // WebKit compatibility: Try multiple RTT field names
            // Safari may report RTT in different fields or formats
            let rtt = reportAny.currentRoundTripTime;
            if (rtt === undefined) rtt = reportAny.roundTripTime;
            if (rtt === undefined) rtt = reportAny.rtt;
            if (rtt === undefined) rtt = reportAny.totalRoundTripTime; // Some WebKit versions
            
            if (typeof rtt === "number" && rtt >= 0) {
              // RTT may be in seconds (standard) or milliseconds (some browsers)
              const latencyMs = rtt < 1 ? Math.round(rtt * 1000) : Math.round(rtt);

              // Only accept reasonable latency values (0ms to 5000ms)
              // Allow 0ms for localhost/testing environments
              if (latencyMs >= 0 && latencyMs <= 5000) {
                totalLatency += latencyMs;
                validMeasurements++;
                foundRtt = true;

                // Store individual measurement
                const measurement: RTCLatencyMeasurement = {
                  latency: latencyMs,
                  timestamp: now,
                  userId,
                };
                measurements.push(measurement);
                break; // Only take one measurement per peer
              }
            }
          }
          
          // WebKit fallback: Try remote-inbound-rtp stats for RTT
          if (!foundRtt && report.type === "remote-inbound-rtp") {
            const reportAny = report as any;
            const rtt = reportAny.roundTripTime;
            if (typeof rtt === "number" && rtt >= 0) {
              const latencyMs = rtt < 1 ? Math.round(rtt * 1000) : Math.round(rtt);
              if (latencyMs >= 0 && latencyMs <= 5000) {
                totalLatency += latencyMs;
                validMeasurements++;
                foundRtt = true;
                
                const measurement: RTCLatencyMeasurement = {
                  latency: latencyMs,
                  timestamp: now,
                  userId,
                };
                measurements.push(measurement);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get RTC stats for user ${userId}:`, error);
      }
    }

    if (validMeasurements > 0) {
      const avgLatency = Math.round(totalLatency / validMeasurements);

      // Store all valid measurements
      measurements.forEach((measurement) => {
        latencyHistoryRef.current.push(measurement);
      });

      // Update immediately for better responsiveness
      setCurrentLatency(avgLatency);
      setIsActive(true);

      // Keep only recent measurements
      if (latencyHistoryRef.current.length > maxHistory) {
        latencyHistoryRef.current =
          latencyHistoryRef.current.slice(-maxHistory);
      }
      setAverageLatency(calculateAverageLatency());
    } else {
      setIsActive(false);
    }
  }, [
    enabled,
    maxHistory,
    calculateAverageLatency,
    useWebRTCMeshManager,
    webRTCMeshManager,
  ]);

  // Start latency measurements
  const startLatencyMeasurement = useCallback(() => {
    if (intervalRef.current || !enabled) return;

    // Send initial measurement immediately
    measureRTCLatency();

    // Set up interval for regular measurements
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
    lastMeasurementRef.current = 0;
  }, []);

  // Add peer connection for monitoring
  const addPeerConnection = useCallback(
    (userId: string, peerConnection: RTCPeerConnection) => {
      peersRef.current.set(userId, peerConnection);

      // Start monitoring if this is the first peer and enabled
      if (enabled && peersRef.current.size === 1) {
        startLatencyMeasurement();
      }
    },
    [enabled, startLatencyMeasurement],
  );

  // Remove peer connection
  const removePeerConnection = useCallback(
    (userId: string) => {
      peersRef.current.delete(userId);

      // Stop monitoring if no peers left
      if (peersRef.current.size === 0) {
        stopLatencyMeasurement();
        resetLatencyMeasurement();
      }
    },
    [stopLatencyMeasurement, resetLatencyMeasurement],
  );

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
  }, [
    enabled,
    startLatencyMeasurement,
    stopLatencyMeasurement,
    resetLatencyMeasurement,
  ]);

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
    measureRTCLatency,
  };
}
