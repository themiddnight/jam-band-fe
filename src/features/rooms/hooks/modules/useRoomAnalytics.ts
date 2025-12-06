import { useEffect, useMemo, useRef } from "react";
import { getRoomContext } from "@/shared/analytics/context";
import {
  trackRoomSessionStart,
  trackRoomSessionEnd,
  type RoomContext,
} from "@/shared/analytics/events";
import { ConnectionState } from "@/features/audio/types/connectionState";

export const useRoomAnalytics = (
  currentRoom: any,
  connectionState: ConnectionState,
) => {
  const roomContext = useMemo(() => getRoomContext(currentRoom), [currentRoom]);
  const analyticsRoomContextRef = useRef<RoomContext>({});
  const roomSessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    analyticsRoomContextRef.current = roomContext;
  }, [roomContext]);

  useEffect(() => {
    const activeContext = roomContext.roomId
      ? roomContext
      : analyticsRoomContextRef.current;

    if (
      connectionState === ConnectionState.IN_ROOM &&
      roomContext.roomId &&
      !roomSessionStartRef.current
    ) {
      roomSessionStartRef.current = Date.now();
      trackRoomSessionStart(roomContext);
    }

    if (
      connectionState !== ConnectionState.IN_ROOM &&
      roomSessionStartRef.current &&
      activeContext.roomId
    ) {
      const duration = Date.now() - roomSessionStartRef.current;
      trackRoomSessionEnd(activeContext, duration);
      roomSessionStartRef.current = null;
    }
  }, [connectionState, roomContext]);

  useEffect(() => {
    return () => {
      if (
        roomSessionStartRef.current &&
        analyticsRoomContextRef.current.roomId
      ) {
        const duration = Date.now() - roomSessionStartRef.current;
        trackRoomSessionEnd(analyticsRoomContextRef.current, duration);
      }
      roomSessionStartRef.current = null;
    };
  }, []);

  return { analyticsRoomContextRef };
};
