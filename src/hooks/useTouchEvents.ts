import { useCallback, useRef, useEffect } from 'react';

interface TouchEventHandlers {
  ref: React.RefObject<HTMLElement | null>;
}

interface UseTouchEventsProps {
  onPress: (isSliderClick?: boolean) => void;
  onRelease: () => void;
  isPlayButton?: boolean; // For play button behavior (no press state tracking)
}

export const useTouchEvents = ({
  onPress,
  onRelease,
  isPlayButton = false
}: UseTouchEventsProps): TouchEventHandlers => {
  const elementRef = useRef<HTMLElement>(null);
  const isPressed = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPlayButton) {
      onPress(false);
    } else if (!isPressed.current) {
      isPressed.current = true;
      onPress(false);
    }
  }, [onPress, isPlayButton]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlayButton) {
      // Play button doesn't track press state
    } else if (isPressed.current) {
      isPressed.current = false;
      onRelease();
    }
  }, [onRelease, isPlayButton]);

  const handleTouchCancel = useCallback((e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlayButton) {
      // Play button doesn't track press state
    } else if (isPressed.current) {
      isPressed.current = false;
      onRelease();
    }
  }, [onRelease, isPlayButton]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add event listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    element.addEventListener('contextmenu', handleContextMenu, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchCancel, handleContextMenu]);

  return {
    ref: elementRef,
  };
}; 