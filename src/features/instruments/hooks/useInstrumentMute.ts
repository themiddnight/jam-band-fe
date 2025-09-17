import { useState, useCallback } from "react";

/**
 * Hook for managing virtual instrument mute state
 * When muted: instrument plays locally only, no socket messages sent
 * When unmuted: instrument broadcasts to other players in the room
 */
export const useInstrumentMute = (initialMuted: boolean = false) => {
  const [isMuted, setIsMuted] = useState(initialMuted);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  return {
    isMuted,
    setMuted,
    toggleMute,
  };
};