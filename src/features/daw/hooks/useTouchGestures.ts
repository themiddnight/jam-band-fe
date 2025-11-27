import { useCallback, useRef, useEffect } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  id: number;
}

interface PinchState {
  initialDistance: number;
  initialZoom: number;
  centerX: number;
  centerY: number;
}

interface PanState {
  lastX: number;
  lastY: number;
}

interface DoubleTapState {
  lastTapTime: number;
  lastTapX: number;
  lastTapY: number;
}

interface UseTouchGesturesOptions {
  /**
   * Current zoom level
   */
  zoom: number;
  /**
   * Callback when zoom changes via pinch
   * @param newZoom - The new zoom level
   * @param centerX - X coordinate of pinch center (in container coordinates)
   * @param centerY - Y coordinate of pinch center (in container coordinates)
   */
  onZoomChange?: (newZoom: number, centerX: number, centerY: number) => void;
  /**
   * Callback when panning with two fingers
   * @param deltaX - Change in X position
   * @param deltaY - Change in Y position
   */
  onPan?: (deltaX: number, deltaY: number) => void;
  /**
   * Callback when double-tap is detected
   * @param x - X coordinate of the tap
   * @param y - Y coordinate of the tap
   */
  onDoubleTap?: (x: number, y: number) => void;
  /**
   * Minimum zoom level
   */
  minZoom?: number;
  /**
   * Maximum zoom level
   */
  maxZoom?: number;
  /**
   * Time window for double-tap detection (ms)
   */
  doubleTapThreshold?: number;
  /**
   * Maximum distance between taps to count as double-tap (px)
   */
  doubleTapDistance?: number;
  /**
   * Whether to prevent default touch behaviors
   */
  preventDefault?: boolean;
  /**
   * Whether gestures are enabled
   */
  enabled?: boolean;
}

interface UseTouchGesturesReturn {
  /**
   * Attach to a container element
   */
  containerRef: (element: HTMLElement | null) => void;
  /**
   * Whether a gesture is currently active
   */
  isGestureActive: boolean;
  /**
   * Handle touch start event (for Konva Stage)
   */
  handleTouchStart: (e: TouchEvent | React.TouchEvent) => void;
  /**
   * Handle touch move event (for Konva Stage)
   */
  handleTouchMove: (e: TouchEvent | React.TouchEvent) => void;
  /**
   * Handle touch end event (for Konva Stage)
   */
  handleTouchEnd: (e: TouchEvent | React.TouchEvent) => void;
}

const getDistance = (touch1: TouchPoint, touch2: TouchPoint): number => {
  const dx = touch2.x - touch1.x;
  const dy = touch2.y - touch1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getCenter = (touch1: TouchPoint, touch2: TouchPoint): { x: number; y: number } => {
  return {
    x: (touch1.x + touch2.x) / 2,
    y: (touch1.y + touch2.y) / 2,
  };
};

const getTouchPoints = (touches: TouchList, containerRect?: DOMRect): TouchPoint[] => {
  const points: TouchPoint[] = [];
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    points.push({
      x: containerRect ? touch.clientX - containerRect.left : touch.clientX,
      y: containerRect ? touch.clientY - containerRect.top : touch.clientY,
      id: touch.identifier,
    });
  }
  return points;
};

export const useTouchGestures = (options: UseTouchGesturesOptions): UseTouchGesturesReturn => {
  const {
    zoom,
    onZoomChange,
    onPan,
    onDoubleTap,
    minZoom = 0.1,
    maxZoom = 10,
    doubleTapThreshold = 300,
    doubleTapDistance = 30,
    preventDefault = true,
    enabled = true,
  } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const doubleTapStateRef = useRef<DoubleTapState>({
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  });
  const isGestureActiveRef = useRef(false);
  const touchCountRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled) return;

      const touches = 'nativeEvent' in e ? e.nativeEvent.touches : e.touches;
      touchCountRef.current = touches.length;

      const containerRect = containerRef.current?.getBoundingClientRect();
      const touchPoints = getTouchPoints(touches, containerRect);

      if (touches.length === 2) {
        // Start pinch/pan gesture
        if (preventDefault) {
          e.preventDefault();
        }
        isGestureActiveRef.current = true;

        const distance = getDistance(touchPoints[0], touchPoints[1]);
        const center = getCenter(touchPoints[0], touchPoints[1]);

        pinchStateRef.current = {
          initialDistance: distance,
          initialZoom: zoom,
          centerX: center.x,
          centerY: center.y,
        };

        panStateRef.current = {
          lastX: center.x,
          lastY: center.y,
        };
      } else if (touches.length === 1) {
        // Check for double-tap
        const now = Date.now();
        const touch = touchPoints[0];
        const doubleTapState = doubleTapStateRef.current;

        const timeDiff = now - doubleTapState.lastTapTime;
        const dx = touch.x - doubleTapState.lastTapX;
        const dy = touch.y - doubleTapState.lastTapY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (timeDiff < doubleTapThreshold && distance < doubleTapDistance) {
          // Double-tap detected
          if (onDoubleTap) {
            if (preventDefault) {
              e.preventDefault();
            }
            onDoubleTap(touch.x, touch.y);
          }
          // Reset double-tap state
          doubleTapStateRef.current = {
            lastTapTime: 0,
            lastTapX: 0,
            lastTapY: 0,
          };
        } else {
          // Record this tap for potential double-tap
          doubleTapStateRef.current = {
            lastTapTime: now,
            lastTapX: touch.x,
            lastTapY: touch.y,
          };
        }
      }
    },
    [enabled, zoom, onDoubleTap, doubleTapThreshold, doubleTapDistance, preventDefault]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled) return;

      const touches = 'nativeEvent' in e ? e.nativeEvent.touches : e.touches;
      
      if (touches.length !== 2) {
        return;
      }

      if (preventDefault) {
        e.preventDefault();
      }

      const containerRect = containerRef.current?.getBoundingClientRect();
      const touchPoints = getTouchPoints(touches, containerRect);

      const distance = getDistance(touchPoints[0], touchPoints[1]);
      const center = getCenter(touchPoints[0], touchPoints[1]);

      // Handle pinch zoom
      if (pinchStateRef.current && onZoomChange) {
        const scale = distance / pinchStateRef.current.initialDistance;
        const newZoom = Math.max(minZoom, Math.min(maxZoom, pinchStateRef.current.initialZoom * scale));
        onZoomChange(newZoom, center.x, center.y);
      }

      // Handle two-finger pan
      if (panStateRef.current && onPan) {
        const deltaX = panStateRef.current.lastX - center.x;
        const deltaY = panStateRef.current.lastY - center.y;
        
        if (deltaX !== 0 || deltaY !== 0) {
          onPan(deltaX, deltaY);
        }
        
        panStateRef.current = {
          lastX: center.x,
          lastY: center.y,
        };
      }
    },
    [enabled, onZoomChange, onPan, minZoom, maxZoom, preventDefault]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled) return;

      const touches = 'nativeEvent' in e ? e.nativeEvent.touches : e.touches;
      touchCountRef.current = touches.length;

      if (touches.length < 2) {
        // Gesture ended
        isGestureActiveRef.current = false;
        pinchStateRef.current = null;
        panStateRef.current = null;
      }
    },
    [enabled]
  );

  // Attach native event listeners for preventDefault to work
  const setContainerRef = useCallback(
    (element: HTMLElement | null) => {
      // Remove old listeners
      if (containerRef.current) {
        containerRef.current.removeEventListener('touchstart', handleTouchStart as EventListener);
        containerRef.current.removeEventListener('touchmove', handleTouchMove as EventListener);
        containerRef.current.removeEventListener('touchend', handleTouchEnd as EventListener);
      }

      containerRef.current = element;

      // Add new listeners with passive: false to allow preventDefault
      if (element && enabled) {
        element.addEventListener('touchstart', handleTouchStart as EventListener, { passive: false });
        element.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        element.addEventListener('touchend', handleTouchEnd as EventListener, { passive: false });
      }
    },
    [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('touchstart', handleTouchStart as EventListener);
        containerRef.current.removeEventListener('touchmove', handleTouchMove as EventListener);
        containerRef.current.removeEventListener('touchend', handleTouchEnd as EventListener);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef: setContainerRef,
    isGestureActive: isGestureActiveRef.current,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};

/**
 * Simple hook to detect if the device supports touch
 */
export const useIsTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
