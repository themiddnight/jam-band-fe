import { useState, useCallback, useEffect, useRef } from "react";

interface UseResizableOptions {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onResize?: (height: number) => void;
}

export function useResizable({
  initialHeight = 400,
  minHeight = 200,
  maxHeight = 800,
  onResize,
}: UseResizableOptions = {}) {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Don't call preventDefault here - let the native event handler do it
      setIsResizing(true);

      // Handle both mouse and touch events
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startYRef.current = clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;

      // Prevent default to stop scrolling during resize
      e.preventDefault();

      // Handle both mouse and touch events
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startYRef.current;
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, startHeightRef.current + deltaY)
      );

      setHeight(newHeight);
      onResize?.(newHeight);
    },
    [isResizing, minHeight, maxHeight, onResize]
  );

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      // Add both mouse and touch event listeners
      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("mouseup", handlePointerUp);
      document.addEventListener("touchmove", handlePointerMove, {
        passive: false,
      });
      document.addEventListener("touchend", handlePointerUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      // Prevent touch scrolling while resizing
      document.body.style.touchAction = "none";

      return () => {
        document.removeEventListener("mousemove", handlePointerMove);
        document.removeEventListener("mouseup", handlePointerUp);
        document.removeEventListener("touchmove", handlePointerMove);
        document.removeEventListener("touchend", handlePointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.touchAction = "";
      };
    }
  }, [isResizing, handlePointerMove, handlePointerUp]);

  // Attach native event listener to handle element for proper preventDefault
  const attachHandleRef = useCallback((element: HTMLDivElement | null) => {
    handleRef.current = element;
    if (element) {
      // Add native touchstart listener with passive: false to allow preventDefault
      const handleTouchStart = (e: TouchEvent) => {
        // Only preventDefault if the event is cancelable
        if (e.cancelable) {
          e.preventDefault();
        }
      };
      element.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });

      return () => {
        element.removeEventListener("touchstart", handleTouchStart);
      };
    }
  }, []);

  return {
    height,
    isResizing,
    handleMouseDown: handlePointerDown,
    attachHandleRef,
  };
}
