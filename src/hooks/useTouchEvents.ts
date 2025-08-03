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
  const isPressed = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isPressed.current) {
      isPressed.current = true;
      onPress(false);
    }
  }, [onPress]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPressed.current) {
      isPressed.current = false;
      onRelease();
    }
  }, [onRelease]);

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPressed.current) {
      isPressed.current = false;
      onRelease();
    }
  }, [onRelease]);

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