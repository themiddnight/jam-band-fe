import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { PING_MEASURE_INTERVAL_MS, PING_UI_THROTTLE_MS } from '@/features/audio/constants/intervals';

interface PingMeasurement {
  ping: number;
  timestamp: number;
}

interface UsePingMeasurementOptions {
  socket?: Socket | null;
  enabled?: boolean;
  interval?: number;
  maxHistory?: number;
}

export function usePingMeasurement({
  socket,
  enabled = true,
  interval = PING_MEASURE_INTERVAL_MS, // default from constants
  maxHistory = 10
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
  const UI_THROTTLE = PING_UI_THROTTLE_MS;

  // Calculate average ping from history
  const calculateAveragePing = useCallback(() => {
    const history = pingHistoryRef.current;
    if (history.length === 0) return null;
    
    const sum = history.reduce((acc, measurement) => acc + measurement.ping, 0);
    return Math.round(sum / history.length);
  }, []);

  // Send ping measurement
  const sendPing = useCallback(() => {
    if (!socket || !socket.connected || !enabled) return;

    const pingId = `ping_${Date.now()}_${Math.random()}`;
    const timestamp = Date.now();
    
    pendingPingsRef.current.set(pingId, timestamp);
    socket.emit('ping_measurement', { pingId, timestamp });

    // Clean up old pending pings (older than 30 seconds)
    const cutoffTime = timestamp - 30000;
    for (const [id, time] of pendingPingsRef.current.entries()) {
      if (time < cutoffTime) {
        pendingPingsRef.current.delete(id);
      }
    }
  }, [socket, enabled]);

  // Handle ping response
  const handlePingResponse = useCallback((data: { pingId: string; timestamp: number }) => {
    if (!data || !data.pingId) return;
    
    const sendTime = pendingPingsRef.current.get(data.pingId);
    if (!sendTime) return;

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
      timestamp: now
    };
    
    pingHistoryRef.current.push(newMeasurement);
    
    // Keep only recent measurements
    if (pingHistoryRef.current.length > maxHistory) {
      pingHistoryRef.current = pingHistoryRef.current.slice(-maxHistory);
    }
    
    // Update average
    setAveragePing(calculateAveragePing());
  }, [maxHistory, calculateAveragePing, UI_THROTTLE]);

  // Start ping measurements
  const startPingMeasurement = useCallback(() => {
  if (intervalRef.current) return;

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
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      if (enabled) {
        // Small delay to ensure connection is stable
        setTimeout(startPingMeasurement, 1000);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      stopPingMeasurement();
      resetPingMeasurement();
    };

    const handleSocketPingResponse = (data: any) => {
      handlePingResponse(data);
    };

    // Add listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('ping_response', handleSocketPingResponse);

    // Check current connection state
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('ping_response', handleSocketPingResponse);
      stopPingMeasurement();
    };
  }, [socket, enabled, startPingMeasurement, stopPingMeasurement, resetPingMeasurement, handlePingResponse]);

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled) {
      stopPingMeasurement();
      resetPingMeasurement();
    } else if (socket?.connected) {
      startPingMeasurement();
    }
  }, [enabled, socket?.connected, startPingMeasurement, stopPingMeasurement, resetPingMeasurement]);

  return {
    currentPing,
    averagePing,
    isConnected,
    isEnabled: enabled,
    resetPingMeasurement,
    sendPing
  };
}
