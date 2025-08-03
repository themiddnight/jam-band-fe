import { useCallback } from 'react';

interface UsePlayButtonTouchEventsProps {
  onPlay: () => void;
}

export const usePlayButtonTouchEvents = ({ onPlay }: UsePlayButtonTouchEventsProps) => {
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPlay();
  }, [onPlay]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onContextMenu: handleContextMenu,
  };
}; 