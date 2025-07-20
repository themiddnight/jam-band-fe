import { useCallback, useRef } from 'react';

interface TouchEventHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const useTouchEvents = (
  onPress: (isSliderClick?: boolean) => void,
  onRelease: () => void
): TouchEventHandlers => {
  const activeTouchIds = useRef<Set<number>>(new Set());

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    for (const touch of Array.from(e.changedTouches)) {
      if (activeTouchIds.current.size === 0) {
        onPress(false); // Regular touch press, not slider click
      }
      activeTouchIds.current.add(touch.identifier);
    }
  }, [onPress]);

  const handleTouchEndAndCancel = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    for (const touch of Array.from(e.changedTouches)) {
      activeTouchIds.current.delete(touch.identifier);
    }

    if (activeTouchIds.current.size === 0) {
      onRelease();
    }
  }, [onRelease]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEndAndCancel,
    onTouchCancel: handleTouchEndAndCancel,
    onContextMenu: handleContextMenu,
  };
}; 