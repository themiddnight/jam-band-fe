import {
  PING_MEASURE_INTERVAL_MS,
  PING_UI_THROTTLE_MS,
} from "@/features/audio/constants/intervals";
import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface PingMeasurement {
  ping: number;
  timestamp: number;
}

interface UsePingMeasurementOptions {
  socket: Socket | null;
  enabled?: boolean;
  interval?: number;
  maxHistory?: number;
}

export function usePingMeasurement({
  socket,
  enabled = true,
  interval = PING_MEASURE_INTERVAL_MS, // default from constants
  maxHistory = 10,
}: UsePingMeasurementOptions) {
  const [currentPing, setCurrentPing] = useState<number | null>(null);
  const [averagePing, setAveragePing] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const pingHistoryRef = useRef<PingMeasurement[]>([]);
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<number | null>(null);
  // Buffer updates to avoid frequent state updates from many responses
  const bufferedPingRef = useRef<number | null>(null);
  const updateTimerRef = useRef<number | null>(null);
  const connectTimerRef = useRef<number | null>(null);
  const UI_THROTTLE = PING_UI_THROTTLE_MS;

  // Track the current socket ID to avoid unnecessary resets
  const currentSocketIdRef = useRef<string | null>(null);
  const lastConnectedStateRef = useRef<boolean>(false);

  // Calculate average ping from history
  const calculateAveragePing = useCallback(() => {
    const history = pingHistoryRef.current;
    if (history.length === 0) return null;

    const sum = history.reduce((acc, measurement) => acc + measurement.ping, 0);
    return Math.round(sum / history.length);
  }, []);

  // Send ping measurement
  const sendPing = useCallback(() => {
    if (!socket || !socket.connected || !enabled) {
      return;
    }

    const pingId = `ping_${Date.now()}_${Math.random()}`;
    const timestamp = Date.now();

    pendingPingsRef.current.set(pingId, timestamp);
    socket.emit("ping_measurement", { pingId, timestamp });

    // Clean up old pending pings (older than 30 seconds)
    const cutoffTime = timestamp - 30000;
    for (const [id, time] of pendingPingsRef.current.entries()) {
      if (time < cutoffTime) {
        pendingPingsRef.current.delete(id);
      }
    }
  }, [socket, enabled]);

  // Handle ping response
  const handlePingResponse = useCallback(
    (data: { pingId: string; timestamp: number }) => {
      if (!data || !data.pingId) {
        return;
      }

      const sendTime = pendingPingsRef.current.get(data.pingId);
      if (!sendTime) {
        return;
      }

      const now = Date.now();
      const pingTime = now - sendTime;

      // Remove from pending
      pendingPingsRef.current.delete(data.pingId);

      // Buffer update (throttle UI updates to ~500ms)
      bufferedPingRef.current = pingTime;
      
      if (!updateTimerRef.current) {
        updateTimerRef.current = window.setTimeout(() => {
          setCurrentPing(bufferedPingRef.current);
          setAveragePing(calculateAveragePing());
          updateTimerRef.current = null;
        }, UI_THROTTLE);
      }

      // Add to history
      const newMeasurement: PingMeasurement = {
        ping: pingTime,
        timestamp: now,
      };

      pingHistoryRef.current.push(newMeasurement);

      // Keep only recent measurements
      if (pingHistoryRef.current.length > maxHistory) {
        pingHistoryRef.current = pingHistoryRef.current.slice(-maxHistory);
      }

      // Update average
      setAveragePing(calculateAveragePing());
    },
    [maxHistory, calculateAveragePing, UI_THROTTLE],
  );

  // Start ping measurements
  const startPingMeasurement = useCallback(() => {
    if (intervalRef.current) {
      return;
    }

    // Send initial ping
    sendPing();

    // Set up interval
    intervalRef.current = window.setInterval(sendPing, interval);
  }, [sendPing, interval]);

  // Stop ping measurements
  const stopPingMeasurement = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }

    // Clear pending pings
    pendingPingsRef.current.clear();

    // Clear pending update timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
  }, []);

  // Reset measurements
  const resetPingMeasurement = useCallback(() => {
    setCurrentPing(null);
    setAveragePing(null);
    pingHistoryRef.current = [];
    pendingPingsRef.current.clear();
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) {
      // No socket provided
      currentSocketIdRef.current = null;
      lastConnectedStateRef.current = false;
      return;
    }

    // Check if this is the same socket connection
    const socketId = socket.id || null;
    const wasConnected = lastConnectedStateRef.current;
    const isCurrentlyConnected = socket.connected;
    const isSameSocket = currentSocketIdRef.current === socketId && socketId !== null;
    
    // Update refs
    currentSocketIdRef.current = socketId;
    lastConnectedStateRef.current = isCurrentlyConnected;

    // Only reset listeners if the socket ID actually changed or connection state changed
    const previousSocketId = currentSocketIdRef.current;
    const shouldReset = !isSameSocket || (wasConnected !== isCurrentlyConnected) || 
                       (previousSocketId === null && socketId !== null);
    
    // Define handlers inline to avoid dependency issues
    const handleConnect = () => {
      setIsConnected(true);
      lastConnectedStateRef.current = true;
      
      // Clear any existing connection timer
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }

      if (enabled) {
        // Small delay to ensure connection is stable
        connectTimerRef.current = window.setTimeout(() => {
          connectTimerRef.current = null;
          if (!intervalRef.current) {
            // Send initial ping
            sendPing();
            // Set up interval
            intervalRef.current = window.setInterval(sendPing, interval);
          }
        }, 1000);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      lastConnectedStateRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      pendingPingsRef.current.clear();
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      setCurrentPing(null);
      setAveragePing(null);
      pingHistoryRef.current = [];
    };

    const handleSocketPingResponse = (data: any) => {
      handlePingResponse(data);
    };

    // Only setup new listeners if we need to reset
    if (shouldReset) {
      // Remove old listeners first (in case of socket ID change)
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("ping_response", handleSocketPingResponse);
      
      // Add new listeners
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("ping_response", handleSocketPingResponse);
    }

    // Check current connection state
    if (socket.connected && !isConnected) {
      handleConnect();
    } else if (!socket.connected && isConnected) {
      handleDisconnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("ping_response", handleSocketPingResponse);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
    };
  }, [socket, enabled, handlePingResponse, sendPing, interval, isConnected]);

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled) {
      stopPingMeasurement();
      resetPingMeasurement();
    } else if (socket?.connected) {
      startPingMeasurement();
    }
  }, [enabled, socket?.connected, stopPingMeasurement, resetPingMeasurement, startPingMeasurement]);

  // Add socket health monitoring and connection state synchronization
  useEffect(() => {
    if (!socket || !enabled) return;

    const healthCheckInterval = setInterval(() => {
      // Sync connection state
      if (socket.connected !== isConnected) {
        if (socket.connected && !isConnected) {
          setIsConnected(true);
          if (!intervalRef.current) {
            startPingMeasurement();
          }
        } else if (!socket.connected && isConnected) {
          setIsConnected(false);
          stopPingMeasurement();
          resetPingMeasurement();
        }
      }
      
      // If socket is connected but we haven't received a ping response recently,
      // try sending a health check ping
      if (socket.connected && pendingPingsRef.current.size === 0 && intervalRef.current) {
        sendPing();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(healthCheckInterval);
  }, [socket, enabled, isConnected, startPingMeasurement, stopPingMeasurement, resetPingMeasurement, sendPing]);

  return {
    currentPing,
    averagePing,
    isConnected,
    startPingMeasurement,
    stopPingMeasurement,
    resetPingMeasurement,
  };
}
