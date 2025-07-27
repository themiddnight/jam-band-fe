import { useCallback, useRef, useEffect } from 'react';

interface TouchEventHandlers {
  ref: React.RefObject<HTMLButtonElement | null>;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const useTouchEvents = (
  onPress: (isSliderClick?: boolean) => void,
  onRelease: () => void
): TouchEventHandlers => {
  const activeTouchIds = useRef<Set<number>>(new Set());
  const elementRef = useRef<HTMLButtonElement | null>(null);

  const handleTouchStart = useCallback((e: Event) => {
    const touchEvent = e as TouchEvent;
    touchEvent.preventDefault();
    
    for (const touch of Array.from(touchEvent.changedTouches)) {
      if (activeTouchIds.current.size === 0) {
        onPress(false); // Regular touch press, not slider click
      }
      activeTouchIds.current.add(touch.identifier);
    }
  }, [onPress]);

  const handleTouchEndAndCancel = useCallback((e: Event) => {
    const touchEvent = e as TouchEvent;
    touchEvent.preventDefault();

    for (const touch of Array.from(touchEvent.changedTouches)) {
      activeTouchIds.current.delete(touch.identifier);
    }

    if (activeTouchIds.current.size === 0) {
      onRelease();
    }
  }, [onRelease]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add event listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEndAndCancel, { passive: false });
    element.addEventListener('touchcancel', handleTouchEndAndCancel, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEndAndCancel);
      element.removeEventListener('touchcancel', handleTouchEndAndCancel);
    };
  }, [handleTouchStart, handleTouchEndAndCancel]);

  return {
    ref: elementRef,
    onContextMenu: handleContextMenu,
  };
}; 