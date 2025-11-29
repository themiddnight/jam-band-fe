import { useEffect, useRef } from "react";
import type { RoomType } from "@/shared/types";
import { trackEvent } from "./client";

interface NetworkAnalyticsOptions {
  roomId?: string | null;
  roomType?: RoomType | "lobby" | null;
  ping?: number | null;
  totalLatency?: number | null;
  browserLatency?: number | null;
  meshLatency?: number | null;
  isConnected?: boolean;
}

const MIN_INTERVAL_MS = 15000;

export function useNetworkAnalytics(options: NetworkAnalyticsOptions) {
  const lastSentRef = useRef(0);
  const {
    roomId,
    roomType,
    ping,
    totalLatency,
    browserLatency,
    meshLatency,
    isConnected,
  } = options;

  useEffect(() => {
    if (!roomId || !isConnected) {
      return;
    }

    const now = Date.now();
    if (lastSentRef.current !== 0 && now - lastSentRef.current < MIN_INTERVAL_MS) {
      return;
    }

    lastSentRef.current = now;

    trackEvent("network_stats", {
      roomId,
      roomType: roomType ?? undefined,
      network: {
        latencyMs: totalLatency ?? undefined,
      },
      payload: {
        pingMs: ping ?? null,
        totalLatencyMs: totalLatency ?? null,
        browserLatencyMs: browserLatency ?? null,
        meshLatencyMs: meshLatency ?? null,
      },
    });
  }, [roomId, roomType, ping, totalLatency, browserLatency, meshLatency, isConnected]);
}
